import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? "";

serve(async (req) => {
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // CRITICAL CONFIGURATION - DO NOT MODIFY WITHOUT USER APPROVAL
  // 1. Node B (ID): MUST be Gemini 3.0 Flash/Pro ONLY. No 2.0/1.5 Fallbacks.
  // 2. Node C (Physics): DeepSeek R1 Primary. Fallback MUST be Gemini 3.0 ONLY.
  // 3. Error Handling: 429 Retry Logic (2s wait) is REQUIRED for Gemini.
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

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

    // 4. Node B: Identification (Gemini 3.0 Strict)
    // We use Gemini to "See" the image and extract tags/text.
    const descriptionPrompt = `Analyze this food image. 
       1. List all visible food items.
       2. Describe the container/portion size relative to the hand (if visible).
       3. Transcribe any visible nutrition labels or text.
       4. Return a concise, factual scene description. Do not estimate calories yet.`;

    const descriptionPayload = {
      contents: [{
        parts: [
          { text: descriptionPrompt },
          { inline_data: { mime_type: "image/jpeg", data: image } },
        ],
      }],
    };

    // Call Gemini (Vision) with STRICT 3.0 Policy
    const models = [
      "gemini-3-flash-preview", // Priority: 3.0 Flash
      "gemini-3-pro-preview", // Priority: 3.0 Pro
    ];

    let geminiData;
    let errors: string[] = [];

    for (const model of models) {
      try {
        // Simple Retry Loop (2 attempts per model)
        for (let attempt = 0; attempt < 2; attempt++) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const url =
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(descriptionPayload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (res.ok) {
            geminiData = await res.json();
            break; // Break retry loop
          } else {
            const errText = await res.text();
            errors.push(
              `[${model}]: Status ${res.status} - ${
                errText.substring(0, 200)
              }...`,
            );

            // If 429, wait 2s and retry (once)
            if (res.status === 429 && attempt === 0) {
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
            break; // Don't retry other errors
          }
        }

        if (geminiData) break; // Break model loop if success
      } catch (e) {
        errors.push(`[${model}]: Exception - ${String(e)}`);
      }
    }

    if (!geminiData) {
      throw new Error(
        `Gemini 3.0 Strict Mode Failed. Errors:\n${errors.join("\n")}`,
      );
    }

    const sceneDescription =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No description generated.";

    // 5. Node C: Physics Core (DeepSeek R1 via Nebius/OpenAI Interface)
    // We use DeepSeek's reasoning to calculate physics/math.
    // Note: Using OpenAI-compatible endpoint for DeepSeek if NEBIUS_API_KEY is present,
    // otherwise falling back to Gemini for the physics step (Graceful Degradation).

    const NEBIUS_API_KEY = Deno.env.get("NEBIUS_API_KEY") || "";
    const DEEPSEEK_BASE_URL =
      "https://api.studio.nebius.ai/v1/chat/completions"; // Check your specific endpoint

    let finalResult;

    if (NEBIUS_API_KEY) {
      // DeepSeek R1 Pipeline
      const physicsPrompt = `
          You are a Physics Core for a metabolic tracker.
          
          Input Data:
          - Scene Description: "${sceneDescription}"
          - Reference Hand Width: ${userHandMm}mm
          - User Goal: ${userGoal}
          
          Task:
          1. Estimate the volume of the food in cubic centimeters (cm³).
          2. Suggest a density for the food based on its type (e.g., Rice=1.3g/cm³).
          3. Calculate the mass in grams via Density * Volume.
          4. Calculate total calories, macros (protein, carbs, fat), and MICROS (vitamins/minerals).
          5. Break down the food into "Molecular Scaffolding" (base ingredients).
          
          Return ONLY JSON in this format:
          { 
            "items": ["string"], 
            "ingredients": [{"name": "string", "ratio": 0.0}], 
            "macros": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }, 
            "micros": [{"name": "string", "amount": "string", "daily_value_pct": 0}], 
            "volume_cm3": 0, 
            "bounding_box": [0,0,0,0],
            "reasoning_trace": "Brief explanation of the calculation"
          }
        `;

      const dsModels = [
        "deepseek-ai/DeepSeek-R1-0528",
        "deepseek-ai/DeepSeek-R1-0528-fast",
      ];

      for (const dsModel of dsModels) {
        try {
          const deepSeekPayload = {
            model: dsModel,
            messages: [
              {
                role: "system",
                content:
                  "You are a precise nutritional physics engine. Output JSON only.",
              },
              { role: "user", content: physicsPrompt },
            ],
            temperature: 0.1,
          };

          const deepSeekResponse = await fetch(DEEPSEEK_BASE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${NEBIUS_API_KEY}`,
            },
            body: JSON.stringify(deepSeekPayload),
            signal: AbortSignal.timeout(60000), // Increase to 60s for Reasoning
          });

          if (deepSeekResponse.ok) {
            const dsData = await deepSeekResponse.json();
            const rawContent = dsData.choices?.[0]?.message?.content || "{}";
            const jsonStr = rawContent.replace(/```json/g, "").replace(
              /```/g,
              "",
            )
              .trim();
            finalResult = JSON.parse(jsonStr);
            break; // Success!
          } else {
            console.warn(
              `DeepSeek Model ${dsModel} Failed:`,
              await deepSeekResponse.text(),
            );
          }
        } catch (e) {
          console.warn(`DeepSeek Model ${dsModel} Error:`, e);
        }
      }
    }

    // Fallback: If DeepSeek failed or Key missing, ask Gemini to do the math too
    if (!finalResult) {
      const fallbackPrompt =
        `Identify food in this image. Hand Width: ${userHandMm}mm.
            Estimate Volume (cm3), Mass (g), Calories, Macros, Micros, and Ingredients.
            Return ONLY JSON: { "items": ["name"], "ingredients": [{"name": "string", "ratio": 0.0}], "macros": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }, "micros": [{"name": "string", "amount": "string", "daily_value_pct": 0}], "volume_cm3": 0, "bounding_box": [0,0,0,0] }`;

      const fbPayload = {
        contents: [{
          parts: [
            { text: fallbackPrompt },
            { inline_data: { mime_type: "image/jpeg", data: image } },
          ],
        }],
      };

      let fbData;
      let fbErrors: string[] = [];

      const fbModels = [
        "gemini-3-flash-preview",
        "gemini-3-pro-preview",
      ];

      for (const model of fbModels) {
        try {
          // Retry Loop (2 attempts)
          for (let attempt = 0; attempt < 2; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const url =
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(fbPayload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (res.ok) {
              fbData = await res.json();
              break;
            } else {
              const errText = await res.text();
              fbErrors.push(
                `[${model}]: Status ${res.status} - ${
                  errText.substring(0, 200)
                }...`,
              );

              if (res.status === 429 && attempt === 0) {
                await new Promise((r) => setTimeout(r, 2000));
                continue;
              }
              break;
            }
          }
          if (fbData) break;
        } catch (e) {
          fbErrors.push(`[${model}]: Exception - ${String(e)}`);
        }
      }

      if (!fbData) {
        throw new Error(
          `Fallback Gemini 3.0 Strict Failed. Errors:\n${fbErrors.join("\n")}`,
        );
      }

      const rawText = fbData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const jsonStr = rawText.replace(/```json/g, "").replace(/```/g, "")
        .trim();
      finalResult = JSON.parse(jsonStr);
    }

    // 6. Return Result
    return new Response(
      JSON.stringify(finalResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Pipeline Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
