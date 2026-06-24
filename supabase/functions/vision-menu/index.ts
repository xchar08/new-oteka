import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? "";
const NEBIUS_API_KEY = Deno.env.get("NEBIUS_API_KEY") ?? "";

// Same env-driven chain convention as vision-pipeline: a preview retirement
// is a secrets change, not a redeploy
const VISION_MODELS = (Deno.env.get("VISION_MODELS") ?? "gemini-3-flash-preview,gemini-2.5-flash")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Robust JSON extraction: markdown fence first, then outermost braces
function extractJson(text: string): any | null {
  const fenced = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
  const candidates = [fenced?.[1], text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1), text];
  for (const c of candidates) {
    if (!c) continue;
    try { return JSON.parse(c.trim()); } catch { /* next candidate */ }
  }
  return null;
}

const clampNum = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

const VALID_IMPACTS = new Set(["super_good", "good", "neutral", "bad", "super_bad"]);

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

    // Run as the calling user (anon key + their JWT) so RLS governs both the
    // DB reads and — critically — the storage download below. A service-role
    // client here would let any caller download arbitrary storage objects.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

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
    const { image, imagePath, bucket = 'food_scans', goal, location_context, latitude, longitude } = body;
    const userGoal = goal || profile?.metabolic_state_json?.current_goal || "maintenance";

    // Build location hint if GPS context is available
    let locationHint = "";
    if (location_context) {
      locationHint = `\nLOCATION CONTEXT: ${location_context}\nUse this to inform your analysis — if user is at a known restaurant, prioritize menu items from that establishment.`;
    }

    let finalImageBase64 = image;
    if (imagePath) {
      const { data: fileData, error: downloadError } = await supabase.storage.from(bucket).download(imagePath);
      if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      finalImageBase64 = btoa(binary);
    }

    // 3. Step 1: High-Fidelity OCR (Gemini 1.5 Flash)
    console.log("[Vision Menu] Step 1: OCR Start");
    const ocrPrompt = `TRANSCRIPTION PROTOCOL: 
    Examine this menu image. 
    Extract EVERY single visible menu item, including its name, price (if visible), and description.
    Output a raw, structured text list of everything you see. Do not skip items.${locationHint}`;

    const ocrPayload = {
      contents: [{
        parts: [
          { text: ocrPrompt },
          { inline_data: { mime_type: "image/jpeg", data: finalImageBase64 } },
        ],
      }],
    };

    // OCR with a fallback chain + retry — the old single-call hard-throw
    // meant one Gemini 429 killed the entire menu scan
    let rawMenuText = "";
    for (const model of VISION_MODELS) {
      for (let attempt = 0; attempt < 2 && !rawMenuText; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000);
          const ocrRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(ocrPayload),
              signal: controller.signal,
            },
          );
          clearTimeout(timeoutId);
          if (ocrRes.ok) {
            const ocrData = await ocrRes.json();
            rawMenuText = ocrData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          } else {
            console.warn(`[Vision Menu] OCR ${model} attempt ${attempt + 1} failed: ${ocrRes.status}`);
            if (ocrRes.status === 429 && attempt === 0) {
              await new Promise((r) => setTimeout(r, 2000));
            }
          }
        } catch (e) {
          console.warn(`[Vision Menu] OCR ${model} error:`, e);
        }
      }
      if (rawMenuText) break;
    }

    // Qwen-VL backup when every Gemini model is unavailable
    if (!rawMenuText && NEBIUS_API_KEY) {
      try {
        const qwenRes = await fetch("https://api.studio.nebius.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${NEBIUS_API_KEY}` },
          body: JSON.stringify({
            model: "Qwen/Qwen2.5-VL-72B-Instruct",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: ocrPrompt },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${finalImageBase64}` } },
              ],
            }],
            max_tokens: 2048,
          }),
        });
        if (qwenRes.ok) {
          const qwenData = await qwenRes.json();
          rawMenuText = qwenData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.warn("[Vision Menu] Qwen-VL OCR backup failed:", e);
      }
    }

    // An empty transcription must stop here — feeding "" into the reasoning
    // step yields hallucinated menus, not an honest error
    if (!rawMenuText.trim()) {
      return new Response(
        JSON.stringify({ error: "Could not read any text from this image. Try a closer, well-lit shot of the menu." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Step 2: Reasoning & Ranking (Gemini 3.0 Flash or Fallback)
    console.log("[Vision Menu] Step 2: Reasoning Start");
    const reasoningPrompt = `
You are the OTEKA Metabolic Engine. You are analyzing a restaurant menu for a user with specific health protocols.

USER GOAL: ${userGoal}
USER MEDICAL CONDITIONS:
${safetyContext}
${locationHint ? `\n${locationHint}` : ''}

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

    let finalParsed: any = null;

    for (const model of VISION_MODELS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: reasoningPrompt }] }] }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          finalParsed = extractJson(text);
          if (finalParsed) break;
        } else if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (e) {
        console.error(`Reasoning failed for ${model}:`, e);
      }
    }

    if (!finalParsed && NEBIUS_API_KEY) {
      // Fallback to DeepSeek via Nebius for reasoning
      try {
        const dsRes = await fetch("https://api.studio.nebius.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${NEBIUS_API_KEY}` },
          body: JSON.stringify({
            model: Deno.env.get("PHYSICS_MODEL") ?? "deepseek-ai/DeepSeek-V3.2",
            messages: [{ role: "user", content: reasoningPrompt }],
            response_format: { type: "json_object" }
          }),
        });
        if (dsRes.ok) {
          const dsData = await dsRes.json();
          finalParsed = extractJson(dsData.choices?.[0]?.message?.content || "{}");
        }
      } catch (e) {
        console.error("Reasoning fallback (Nebius) failed:", e);
      }
    }

    if (!finalParsed) throw new Error("Reasoning engine failed");

    // Output sanitation: coerce + clamp every number, whitelist impact labels
    finalParsed.items = (Array.isArray(finalParsed.items) ? finalParsed.items : [])
      .filter((it: any) => it && (it.name || "").toString().trim())
      .map((it: any) => ({
        ...it,
        name: String(it.name),
        description: String(it.description ?? ""),
        estimated_calories: Math.round(clampNum(it.estimated_calories, 0, 8000)),
        health_score: Math.round(clampNum(it.health_score, 1, 10)),
        metabolic_impact: VALID_IMPACTS.has(it.metabolic_impact) ? it.metabolic_impact : "neutral",
        layman_explanation: String(it.layman_explanation ?? ""),
        tags: Array.isArray(it.tags) ? it.tags.map(String) : [],
      }))
      .sort((a: any, b: any) => b.health_score - a.health_score);
    finalParsed.restaurant_name = String(finalParsed.restaurant_name ?? "");
    finalParsed.dietary_warnings = Array.isArray(finalParsed.dietary_warnings)
      ? finalParsed.dietary_warnings.map(String)
      : [];

    if (finalParsed.items.length === 0) {
      return new Response(
        JSON.stringify({ error: "The menu text could not be parsed into items. Try capturing one menu page at a time." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

