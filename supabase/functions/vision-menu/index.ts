import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? "";
const NEBIUS_API_KEY = Deno.env.get("NEBIUS_API_KEY") ?? "";

Deno.serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-token",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    console.log(`[Vision Menu] Incoming ${req.method} request`);
    
    // 1. Auth Check
    const authHeader = req.headers.get("Authorization");
    const customAuth = req.headers.get("x-user-token");

    let token = "";
    if (customAuth) {
      token = customAuth;
    } else if (authHeader) {
      token = authHeader.replace(/Bearer\s+/i, "").trim();
    }

    if (!token) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // 2. Load User Context (Goal + Conditions)
    const { data: profile } = await supabase.from("users").select("metabolic_state_json").eq("id", user.id).single();
    const { data: medicalContext } = await supabase.from("user_conditions").select(`condition_id, conditions(name, rules_json, never_recommend_json)`).eq("user_id", user.id);

    let safetyContext = "None.";
    if (medicalContext && medicalContext.length > 0) {
      safetyContext = medicalContext.map((c: any) => {
        const cond = c.conditions;
        const rules = Array.isArray(cond.rules_json) ? cond.rules_json.join(", ") : JSON.stringify(cond.rules_json);
        const avoid = Array.isArray(cond.never_recommend_json) ? cond.never_recommend_json.join(", ") : "";
        return `- **${cond.name}**: Rules [${rules}]. AVOID: [${avoid}]`;
      }).join("\n");
    }

    const body = await req.json();
    const { image, imagePath, bucket = 'food_scans', goal } = body;
    const userGoal = goal || profile?.metabolic_state_json?.current_goal || "maintenance";

    let finalImageBase64 = image;
    if (imagePath) {
      const { data: fileData, error: downloadError } = await supabase.storage.from(bucket).download(imagePath);
      if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);
      const arrayBuffer = await fileData.arrayBuffer();
      finalImageBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    }

    // 3. Step 1: High-Fidelity OCR (Gemini 1.5 Flash)
    console.log("[Vision Menu] Step 1: OCR Start");
    const ocrPrompt = `TRANSCRIPTION PROTOCOL: 
    Examine this menu image. 
    Extract EVERY single visible menu item, including its name, price (if visible), and description.
    Output a raw, structured text list of everything you see. Do not skip items.`;

    const ocrPayload = {
      contents: [{
        parts: [
          { text: ocrPrompt },
          { inline_data: { mime_type: "image/jpeg", data: finalImageBase64 } },
        ],
      }],
    };

    const ocrRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ocrPayload),
    });

    if (!ocrRes.ok) throw new Error("OCR Step Failed");
    const ocrData = await ocrRes.json();
    const rawMenuText = ocrData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 4. Step 2: Reasoning & Ranking (Gemini 3.0 Flash or Fallback)
    console.log("[Vision Menu] Step 2: Reasoning Start");
    const reasoningPrompt = `
You are the OTEKA Metabolic Engine. You are analyzing a restaurant menu for a user with specific health protocols.

USER GOAL: ${userGoal}
USER MEDICAL CONDITIONS:
${safetyContext}

MENU TEXT:
${rawMenuText}

TASK:
1. Parse ALL extracted items.
2. For each item, calculate:
   - estimated_calories (int)
   - health_score (1-10): 10 is perfect metabolic alignment, 1 is toxic for this specific user.
   - metabolic_impact: "super_good", "good", "neutral", "bad", "super_bad".
   - layman_explanation: Why this score? Mention specific ingredients or prep methods.
3. RANK ALL ITEMS from highest health_score to lowest.
4. Flag items that violate MEDICAL CONDITIONS as health_score 1 and metabolic_impact "super_bad".

RETURN JSON ONLY:
{
  "restaurant_name": "string",
  "items": [
    {
      "name": "string",
      "description": "string",
      "estimated_calories": 0,
      "health_score": 0,
      "metabolic_impact": "string",
      "layman_explanation": "string",
      "tags": ["string"]
    }
  ],
  "dietary_warnings": ["string"]
}
`.trim();

    // Use Gemini 3.0 Flash for superior reasoning if available, else 1.5 Pro/Flash
    const models = ["gemini-3-flash-preview", "gemini-1.5-pro"];
    let finalParsed: any = null;

    for (const model of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: reasoningPrompt }] }] }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          const json = text.replace(/```json/g, "").replace(/```/g, "").trim();
          finalParsed = JSON.parse(json);
          break;
        }
      } catch (e) {
        console.error(`Reasoning failed for ${model}:`, e);
      }
    }

    if (!finalParsed && NEBIUS_API_KEY) {
      // Fallback to DeepSeek V3 via Nebius for reasoning
      const dsRes = await fetch("https://api.studio.nebius.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${NEBIUS_API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-ai/DeepSeek-V3",
          messages: [{ role: "user", content: reasoningPrompt }],
          response_format: { type: "json_object" }
        }),
      });
      if (dsRes.ok) {
        const dsData = await dsRes.json();
        finalParsed = JSON.parse(dsData.choices[0].message.content);
      }
    }

    if (!finalParsed) throw new Error("Reasoning engine failed");

    return new Response(JSON.stringify(finalParsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[Vision Menu] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

