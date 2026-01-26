import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const GOOGLE_API_KEY = Deno.env.get("PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY") || "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    const supabase = createClient(
      Deno.env.get("PUBLIC_SUPABASE_URL") ?? "",
      Deno.env.get("PUBLIC_SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { image, goal } = await req.json(); // base64 JPEG (no prefix) + goal string
    if (!image) return new Response("No image provided", { status: 400 });

    // 1. Call Gemini to parse the menu and suggest items
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

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

    if (!gemRes.ok) {
      const txt = await gemRes.text();
      console.error("Gemini menu error:", gemRes.status, txt);
      throw new Error("Gemini menu failed");
    }

    const gemData = await gemRes.json();
    const rawText =
      gemData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const jsonStr = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(jsonStr);

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
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("vision-menu error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
