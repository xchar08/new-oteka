import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? "";

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-user-token",
  };

  // Handle Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth Check (Gateway Bypass Strategy)
    const authHeader = req.headers.get("Authorization");
    const customAuth = req.headers.get("x-user-token");

    let token = "";
    let authMethod = "none";

    if (customAuth) {
      token = customAuth;
      authMethod = "custom_header";
    } else if (authHeader) {
      token = authHeader.replace("Bearer ", "");
      authMethod = "standard_bearer";
    }

    if (!token) {
      return new Response("Missing Authorization (Header or x-user-token)", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Service role key for server-side (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: `Bearer ${token}` } }, // Forward user token? No, context is easier with getUser
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    // Explicitly verify the token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("Auth User Search Failed:", error);
      return new Response(
        JSON.stringify({
          error: `Unauthorized: ${error?.message || "User not found"}`,
          debug_auth: {
            has_user: !!user,
            error_details: error,
            diag: {
              auth_method: authMethod,
              received_token_len: token.length,
              token_preview: token.slice(-5),
              // Extract 'wnfnyhmq...' from https://wnfnyhmq...supabase.co
              project_ref:
                (Deno.env.get("SUPABASE_URL") ?? "").split("://")[1]?.split(
                  ".",
                )[0] || "unknown",
              has_env_anon: !!Deno.env.get("SUPABASE_ANON_KEY"),
              lib_version: "2.39.3",
            },
          },
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Parse Body
    const { image, mode } = await req.json();
    if (!image) {
      return new Response("No image provided", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 3. Fetch User Profile for Calibration
    const { data: profile } = await supabase
      .from("users")
      .select("hand_width_mm, metabolic_state_json")
      .eq("id", user.id)
      .single();

    const userHandMm = profile?.hand_width_mm || 85; // Default 85mm
    const userGoal = profile?.metabolic_state_json?.current_goal ||
      "maintenance";

    // 4. Call Google Gemini (w/ Retry & Fallback)
    let promptText =
      `Identify the food in this image. The user's hand (palm width: ${userHandMm}mm) may be visible for scale. 
      Use this scale to estimate absolute volume in cm3 and mass in grams with high precision.
      User Goal: ${userGoal}.
      Break it down into base ingredients (scaffolding) with ratios. 
      Return ONLY JSON format: { "items": ["name"], "ingredients": [{"name": "string", "ratio": 0.0}], "macros": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }, "volume_cm3": 0, "bounding_box": [ymin, xmin, ymax, xmax] } (bounding_box 0-1000 scale)`;

    if (mode === "pantry") {
      promptText =
        'Identify all distinct food items in this image for pantry inventory. Return ONLY JSON format: { "pantry_items": [{ "name": "Item Name", "category": "dairy|meat|produce|grain|other", "expiry_estimate": "7 days" }] }';
    }

    const payload = {
      contents: [{
        parts: [
          { text: promptText },
          { inline_data: { mime_type: "image/jpeg", data: image } },
        ],
      }],
    };

    const models = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GOOGLE_API_KEY}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_API_KEY}`, // Fallback 1
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`, // Fallback 2
    ];

    let geminiRes;
    let txt;

    // Try up to 3 times with the primary model, then failover
    for (const modelUrl of models) {
      let attempts = 0;
      let success = false;

      while (attempts < 2 && !success) {
        try {
          geminiRes = await fetch(modelUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (geminiRes.status === 503) {
            console.warn(`Model Overloaded (${modelUrl}). Retrying...`);
            attempts++;
            await new Promise((r) => setTimeout(r, 1000 * attempts)); // Backoff
            continue;
          }

          if (!geminiRes.ok) {
            txt = await geminiRes.text();
            // If it's not 503 but still error, break to try next model or fail
            break;
          }

          success = true;
        } catch (e) {
          console.error("Fetch Error:", e);
          attempts++;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (success) break;
      console.warn(`Failed with model ${modelUrl}, failing over...`);
    }

    if (!geminiRes || !geminiRes.ok) {
      txt = txt || await geminiRes?.text() || "Unknown Error";
      console.error("Gemini Final Error:", txt);
      throw new Error(
        `Gemini API Failed: ${geminiRes?.status || "Net"} - ${txt}`,
      );
    }

    const geminiData = await geminiRes.json();

    // 4. Parse Gemini Response
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "{}";
    const jsonStr = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedAI = JSON.parse(jsonStr);

    // 5. Log to Database (Audit)
    // Only log singles for now, or adapt logging for pantry later
    if (mode !== "pantry") {
      await supabase.from("logs").insert({
        user_id: user.id,
        grams: parsedAI.macros?.grams || 0,
        metabolic_tags_json: {
          food_name: parsedAI.items?.[0] || "Unknown",
          macros: parsedAI.macros,
          source: "vision-pipeline",
        },
      });
    }

    // 6. Return Result
    return new Response(
      JSON.stringify({
        ...parsedAI,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
