import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? "";
const NEBIUS_API_KEY = Deno.env.get("NEBIUS_API_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    // ✅ FIXED: Service role key for server-side (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const { image, goal } = await req.json(); // base64 JPEG (no prefix) + goal string
    if (!image) return new Response("No image provided", { status: 400, headers: corsHeaders });

    // 1. Call Gemini to parse the menu and suggest items
    const systemPrompt = `
You are a nutrition coach. You receive a photo of a restaurant menu (possibly partial).

1. Identify 3–10 menu items with:
   - name
   - short description
   - estimated calories (integer)
   - health_score from 1–10 (higher is better for metabolic health)
   - tags: array of strings, e.g. ["high_protein","low_carb","fried","vegetarian"].

2. Consider this user goal: "${goal || "maintenance"}".

3. Return ONLY strict JSON in the form:
{
  "restaurant_name": "Optional Name",
  "items": [
    {
      "name": "Grilled Chicken Salad",
      "description": "Grilled chicken with mixed greens and vinaigrette.",
      "estimated_calories": 450,
      "health_score": 8,
      "tags": ["high_protein","low_carb","salad"]
    }
  ],
  "dietary_warnings": ["if any major issues or NONE"]
}
`.trim();

    let parsed: any = null;

    // Try Gemini First
    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

      const payload = {
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { inline_data: { mime_type: "image/jpeg", data: image } },
            ],
          },
        ],
      };

      const gemRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (gemRes.ok) {
        const gemData = await gemRes.json();
        const rawText =
          gemData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const jsonStr = rawText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        parsed = JSON.parse(jsonStr);
      } else {
        console.warn("Gemini menu failed, trying Nebius...");
      }
    } catch (e) {
      console.error("Gemini menu exception:", e);
    }

    // Fallback to Nebius Qwen-VL
    if (!parsed && NEBIUS_API_KEY) {
      console.log("Using Nebius Qwen-VL fallback for menu scan...");
      const qwenPayload = {
        model: "Qwen/Qwen2.5-VL-72B-Instruct",
        messages: [
          {
            role: "system",
            content: "You are a metabolic tracker AI. Output JSON only.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${image}` },
              },
            ],
          },
        ],
        max_tokens: 2048,
        response_format: { type: "json_object" },
      };

      const qwenRes = await fetch(
        "https://api.studio.nebius.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${NEBIUS_API_KEY}`,
          },
          body: JSON.stringify(qwenPayload),
        },
      );

      if (qwenRes.ok) {
        const qwenData = await qwenRes.json();
        const content = qwenData.choices?.[0]?.message?.content;
        if (content) {
          parsed = JSON.parse(content);
        }
      } else {
        console.error("Nebius Qwen-VL menu failed:", await qwenRes.text());
      }
    }

    if (!parsed) {
      throw new Error("All vision models failed to parse menu");
    }

    // 2. Optionally log to Supabase for analytics
    await supabase.from("logs").insert({
      user_id: user.id,
      grams: 0,
      metabolic_tags_json: {
        type: "menu_scan",
        goal: goal || "maintenance",
        restaurant_name: parsed.restaurant_name ?? null,
      },
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("vision-menu error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
