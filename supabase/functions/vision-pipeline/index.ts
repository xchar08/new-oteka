import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

// ✅ FIXED: Removed PUBLIC_ prefix (server-only secret)
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ?? '';

serve(async (req) => {
  try {
    // 1. Auth Check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Missing Authorization', { status: 401 })

    // ✅ FIXED: Service role key for server-side (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return new Response('Unauthorized', { status: 401 })

    // 2. Parse Body
    const { image } = await req.json()
    if (!image) return new Response('No image provided', { status: 400 })

    // 3. Call Google Gemini 1.5 Flash (Vision)
    // We construct the request manually since we can't use the Node SDK in Deno easily
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
    
    const payload = {
      contents: [{
        parts: [
          { text: "Identify the food in this image. Estimate mass in grams and macronutrients (calories, protein, carbs, fat). Return ONLY JSON format: { \"items\": [\"name\"], \"macros\": { \"calories\": 0, \"protein\": 0, \"carbs\": 0, \"fat\": 0 } }" },
          { inline_data: { mime_type: "image/jpeg", data: image } }
        ]
      }]
    };

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiRes.ok) {
      const txt = await geminiRes.text();
      console.error("Gemini Error:", txt);
      throw new Error(`Gemini API Failed: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    
    // 4. Parse Gemini Response
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    // Sanitize markdown code blocks if present
    const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedAI = JSON.parse(jsonStr);

    // 5. Log to Database (Audit)
    await supabase.from('logs').insert({
      user_id: user.id,
      grams: parsedAI.macros?.grams || 0,
      metabolic_tags_json: {
        food_name: parsedAI.items?.[0] || 'Unknown',
        macros: parsedAI.macros,
        source: 'vision-pipeline'
      }
    });

    // 6. Return Result
    return new Response(JSON.stringify({
      summary: {
        name: parsedAI.items?.[0] || 'Food',
        calories: parsedAI.macros?.calories || 0
      },
      ...parsedAI
    }), { headers: { "Content-Type": "application/json" } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    })
  }
})
