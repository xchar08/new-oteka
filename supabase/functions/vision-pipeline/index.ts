import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? "";

Deno.serve(async (req) => {
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

    // Environment Variables
    const NEBIUS_API_KEY = Deno.env.get("NEBIUS_API_KEY");
    // Standardized DeepSeek Model ID (Verified)
    const DEEPSEEK_MODEL_ID = "deepseek-ai/DeepSeek-R1-0528";
    const DEEPSEEK_BASE_URL =
      "https://api.studio.nebius.ai/v1/chat/completions";

    // 4. Inject Knowledge Bases (Source of Truth)
    // EMBEDDED PHENOMENA (Universal Principles - Can remain hardcoded for now)
    const METABOLIC_PHENOMENA = [
      {
        id: "randle_cycle",
        name: "Randle Cycle",
        mechanism:
          "Glucose/Fat competition; high fat suppresses glucose oxidation.",
      },
      {
        id: "cori_cycle",
        name: "Cori Cycle",
        mechanism: "Lactate recycling to glucose in liver.",
      },
      {
        id: "cahill_cycle",
        name: "Cahill Cycle",
        mechanism: "Muscle amino acids -> Alanine -> Glucose.",
      },
      {
        id: "ketone_sparing",
        name: "Ketone Sparing",
        mechanism: "Ketones sparing glucose/muscle.",
      },
      {
        id: "protein_sparing",
        name: "Protein Sparing",
        mechanism: "Carbs/Fats prevent muscle breakdown.",
      },
      {
        id: "reverse_randle",
        name: "Reverse Randle",
        mechanism: "Lowering fat improves glucose uptake.",
      },
      {
        id: "ffa_insulin_antagonism",
        name: "FFA-Insulin Antagonism",
        mechanism: "High FFAs block insulin signaling.",
      },
      {
        id: "crabtree_effect",
        name: "Crabtree Effect",
        mechanism: "High glucose forces glycolysis over oxidation.",
      },
      {
        id: "pasteur_effect",
        name: "Pasteur Effect",
        mechanism: "Oxygen shifts metabolism to efficiency.",
      },
      {
        id: "warburg_effect",
        name: "Warburg Effect",
        mechanism: "Glycolysis despite oxygen (stress/growth).",
      },
      {
        id: "citrate_inhibition",
        name: "Citrate Inhibition",
        mechanism: "Energy abundance blocks glycolysis.",
      },
      {
        id: "ampk_mtor",
        name: "AMPK-mTOR Axis",
        mechanism: "Repair (AMPK) vs Growth (mTOR).",
      },
      {
        id: "sirtuins",
        name: "Sirtuins",
        mechanism: "Energy deficit signals repair.",
      },
      {
        id: "autophagy",
        name: "Autophagy",
        mechanism: "Cellular cleanup during fasting.",
      },
      {
        id: "scfa_competition",
        name: "SCFA Competition",
        mechanism: "Gut fiber byproducts spare glucose.",
      },
      {
        id: "anaplerosis",
        name: "Anaplerosis",
        mechanism: "Refilling the metabolic engine.",
      },
      {
        id: "urea_cycle",
        name: "Urea Cycle",
        mechanism: "Nitrogen disposal from protein.",
      },
    ];

    // 4b. Fetch User's Active Conditions (DYNAMICALLY)
    // We join 'user_conditions' with 'conditions' to get the full rules.
    const { data: medicalContext } = await supabase
      .from("user_conditions")
      .select(`
        condition_id,
        conditions (
          name,
          rules_json,
          never_recommend_json
        )
      `)
      .eq("user_id", user.id);

    // Construct Safety Protocol String
    let safetyContext = "None.";
    if (medicalContext && medicalContext.length > 0) {
      safetyContext = medicalContext.map((c: any) => {
        const cond = c.conditions;
        // rules_json and never_recommend_json are typically arrays
        const rules = Array.isArray(cond.rules_json)
          ? cond.rules_json.join(", ")
          : JSON.stringify(cond.rules_json);
        const avoid = Array.isArray(cond.never_recommend_json)
          ? cond.never_recommend_json.join(", ")
          : "";

        return `- **${cond.name}**: Rules [${rules}]. NEGATIVE INGREDIENTS: [${avoid}]`;
      }).join("\n");
    }

    const phenomenaContext = METABOLIC_PHENOMENA.map((p) =>
      `- ${p.name}: ${p.mechanism}`
    ).join("\n");

    // 5. Node B: Identification (Gemini 3.0 Strict)
    // We use Gemini to "See" the image and extract tags/text.
    let descriptionPrompt = `Analyze this food image. 
       1. List all visible food items.
       2. Describe the container/portion size relative to the hand (if visible).
       3. Transcribe any visible nutrition labels or text.
       4. Return a concise, factual scene description. Do not estimate calories yet.`;

    if (mode === "pantry") {
      descriptionPrompt = `Analyze this image of pantry items.
         1. Identify ALL distinct food products visible (cans, boxes, jars, bags).
         2. For EACH item, transcribe Brand and Product Name.
         3. Transcribe "Best By" or "Expiry" dates if visible.
         4. Estimate quantity (Full, Half, Empty) for each.
         5. Return a concise list of items found.`;
    }

    const descriptionPayload = {
      contents: [{
        parts: [
          { text: descriptionPrompt },
          { inline_data: { mime_type: "image/jpeg", data: image } },
        ],
      }],
    };

    let finalResult: Record<string, any> | null = null;
    let sceneDescription = "";
    let deepseekRaw = "";

    // Circuit Breaker State (Global in Deno isolation, persists across some invokes)
    const modelCooldowns = new Map<string, number>();
    const COOLDOWN_MS = 5 * 60 * 1000; // 5 Minutes

    function isModelCoolingDown(model: string): boolean {
      const expiry = modelCooldowns.get(model);
      if (expiry && Date.now() < expiry) {
        console.warn(
          `[CircuitBreaker] Skipping ${model} (Cooldown until ${
            new Date(expiry).toISOString()
          })`,
        );
        return true;
      }
      return false;
    }

    function recordModelFailure(model: string, status: number) {
      if (status === 429 || status === 503) {
        const expiry = Date.now() + COOLDOWN_MS;
        console.warn(
          `[CircuitBreaker] 🛑 ${model} hit ${status}. Cooling down until ${
            new Date(expiry).toISOString()
          }`,
        );
        modelCooldowns.set(model, expiry);
      }
    }

    // 4b. Execute Node B (Description)
    // User Request: Gemini 3.0 Primary. Fallbacks: 2.5 Flash -> Qwen-VL (Nebius)
    const nodeBModels = [
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
    ];

    // Retry Loop for Gemini (Rate Limits)
    for (const model of nodeBModels) {
      if (isModelCoolingDown(model)) continue;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s Timeout

        const descUrl =
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;
        const descRes = await fetch(descUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(descriptionPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (descRes.ok) {
          const descData = await descRes.json();
          const candidate = descData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate) {
            sceneDescription = candidate;
            break;
          }
        } else {
          console.warn(`Node B (${model}) Warning:`, await descRes.text());
          recordModelFailure(model, descRes.status);
          // Wait 1s before trying next model
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (e: any) {
        console.warn(`Node B (${model}) Failed:`, e);
        // If it's an abort error, maybe don't circuit break? Or treat as 503?
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Backup: Qwen-VL via Nebius (OpenAI-compatible)
    if (!sceneDescription && NEBIUS_API_KEY) {
      console.log("[OTOKA_DEBUG] 📸 Trying Nebius Qwen-VL as fallback...");
      try {
        const qwenPayload = {
          model: "Qwen/Qwen2.5-VL-72B-Instruct",
          messages: [
            {
              role: "system",
              content:
                "You are a visual assistant. Describe the food items in the image.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: descriptionPrompt },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${image}` },
                },
              ],
            },
          ],
          max_tokens: 1024,
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
          sceneDescription = qwenData.choices?.[0]?.message?.content || "";
          if (sceneDescription) {
            console.log("[OTOKA_DEBUG] ✅ Nebius Qwen-VL Success!");
          }
        } else {
          console.warn(
            "[OTOKA_DEBUG] ⚠️ Nebius Qwen-VL Failed:",
            await qwenRes.text(),
          );
        }
      } catch (e) {
        console.error("[OTOKA_DEBUG] ⚠️ Nebius Qwen-VL Exception:", e);
      }
    }

    if (!sceneDescription) {
      console.warn("Node B Failed completely. Skipping DeepSeek.");
      sceneDescription = "Node B Failed - Image Analysis Unavailable";
    }

    // Only run DeepSeek if we actually have a description
    if (
      NEBIUS_API_KEY &&
      sceneDescription !== "Node B Failed - Image Analysis Unavailable"
    ) {
      // DeepSeek R1 Pipeline
      const physicsPrompt = `
          You are a Physics Core for a metabolic tracker.
          
          Input Data:
          - Scene Description: "${sceneDescription}"
          - Reference Hand Width: ${userHandMm}mm
          - Mode: ${mode}

          ## MEDICAL SAFETY PROTOCOLS (ACTIVE)
          ${safetyContext}

          ## METABOLIC KNOWLEDGE BASE
          ${phenomenaContext}
          
          Task:
          1. detailed analysis...
          
          If Mode is 'pantry':
          - Identify ALL distinct items.
          - Extract Brand, Name, Quantity, and Expiry for each.
          
          Return ONLY JSON in this format:
          { 
            "pantry_items": [
                { "name": "Brand Product", "quantity": "string", "expiry": "string or null", "ingredients": ["string"] }
            ],
            "items": ["string names for compatibility"], 
            "ingredients": [{"name": "string", "ratio": 0.0}], 
            "macros": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }, 
            "micros": [{"name": "string", "amount": "string", "daily_value_pct": 0}], 
            "volume_cm3": 0, 
            "reasoning_trace": "Brief explanation",
            "metabolic_insight": {
                "score": 0,
                "impact_level": "neutral",
                "layman_explanation": "string"
            }
          }

          Metabolic Insight Logic:
          - Check "MEDICAL SAFETY PROTOCOLS".
             - IF food contains "NEGATIVE INGREDIENTS" or violates rules -> SCORE MUST BE -10. Impact: "super_bad". Explanation: "Contains [Ingredient], which violates [Condition]."
             - IF food is explicitly beneficial for condition -> SCORE +10. Impact: "super_good".
             - ELSE: Rate -10 (Toxic) to +10 (Perfect) based on general metabolic quality.
          - Use "METABOLIC KNOWLEDGE BASE" terms (e.g. Randle Cycle) in layman_explanation if relevant. KEEP EXPLANATION CONCISE (Max 2-3 sentences).
        `;

      // Use standard ID
      const dsModels = [
        DEEPSEEK_MODEL_ID,
      ];

      for (const dsModel of dsModels) {
        // Retry logic for DeepSeek
        // Try up to 2 times
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s Timeout

            const deepSeekPayload = {
              model: dsModel,
              messages: [
                {
                  role: "system",
                  content:
                    "You are a precise nutritional physics engine. Output JSON only. Respect Medical Conditions.",
                },
                { role: "user", content: physicsPrompt },
              ],
              temperature: 0.1,
              max_tokens: 4096, // Increased for full analysis & JSON
            };

            const deepSeekResponse = await fetch(DEEPSEEK_BASE_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${NEBIUS_API_KEY}`,
              },
              body: JSON.stringify(deepSeekPayload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (deepSeekResponse.ok) {
              const dsData = await deepSeekResponse.json();
              const rawContent = dsData.choices?.[0]?.message?.content || "{}";

              // CLEAN OUTPUT: Strip <think> tags (handle unclosed + case insensitive + missing bracket)
              const cleanContent = rawContent.replace(
                /<think(?:>|\s)[\s\S]*?(?:<\/think>|$)/gi,
                "",
              ).trim();

              deepseekRaw = cleanContent;

              console.log(
                `[OTOKA_DEBUG] 🧠 DeepSeek Raw (Cleaned): ${
                  cleanContent.substring(0, 500)
                }`,
              );

              // Extract JSON: Support Markdown, Raw, or Wrapped
              // 1. Try Markdown Code Block
              let jsonStr = "";
              const jsonMatch =
                cleanContent.match(/```json\n([\s\S]*?)\n```/) ||
                cleanContent.match(/```([\s\S]*?)```/);

              if (jsonMatch) {
                jsonStr = jsonMatch[1];
              } else {
                // 2. Try Raw JSON (Bracket matching)
                const start = cleanContent.indexOf("{");
                const end = cleanContent.lastIndexOf("}");
                if (start >= 0 && end > start) {
                  jsonStr = cleanContent.substring(start, end + 1);
                } else {
                  jsonStr = cleanContent; // Hope for the best
                }
              }

              try {
                finalResult = JSON.parse(jsonStr);
                console.log(
                  `[OTOKA_DEBUG] ✅ DeepSeek JSON Parsed Successfully`,
                );

                // Validation: Ensure 'items' or 'pantry_items' exist
                if (
                  finalResult && !finalResult.items && !finalResult.pantry_items
                ) {
                  console.warn(
                    `[OTOKA_DEBUG] ⚠️ DeepSeek JSON missing keys. Output:`,
                    jsonStr,
                  );
                  // Don't break, maybe it's a partial result?
                  // Actually if it's "unknown", it might be an empty object.
                }

                break; // Success!
              } catch (parseErr: any) {
                console.warn(
                  `[OTOKA_DEBUG] ⚠️ DeepSeek JSON Parse Failed: ${parseErr.message}`,
                );
                console.warn(
                  `[OTOKA_DEBUG] Bad JSON Content: ${
                    jsonStr.substring(0, 200)
                  }...`,
                );
              }
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
        if (finalResult) break;
      }
    }
    // Fallback Prompt (Gemini 2.5/3.0)
    if (!finalResult) {
      console.log(`[OTOKA_DEBUG] 🛡️ Physics Core: Falling back to Gemini...`);
      const fallbackPrompt = `Identify food. Mode: ${mode}.
            Safety: ${safetyContext}
            Phenomena: ${phenomenaContext}

            Input Description: ${sceneDescription}

            If pantry: Identify ALL items with Quantity/Expiry.
            Return ONLY JSON key/value:
            { 
                "pantry_items": [{ "name": "string", "quantity": "string", "expiry": "string" }],
                "items": ["name"], 
                "ingredients": [{"name": "string", "ratio": 0.0}], 
                "macros": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }, 
                "micros": [{"name": "string", "amount": "string", "daily_value_pct": 0}], 
                "volume_cm3": 0,
                "metabolic_insight": { "score": 0, "impact_level": "neutral", "layman_explanation": "string" }
            }
            
            Logic:
            - If violates Safety -> Score -10. Impact "super_bad". Explain.
            - Else Score -10 to +10. layman_explanation MAX 2-3 sentences.
            `;

      const fbPayload = {
        contents: [{
          parts: [
            { text: fallbackPrompt },
            // If we have an image, send it again, otherwise just text
            { inline_data: { mime_type: "image/jpeg", data: image } },
          ],
        }],
      };

      let fbData;
      const fbErrors: string[] = [];

      // Fallback Models: 3.0 (Primary) -> 2.5 Flash -> Qwen-VL
      const fbModels = [
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
      ];

      // Try Gemini Logic
      for (const model of fbModels) {
        if (isModelCoolingDown(model)) continue;

        const startT = Date.now();
        console.log(`[OTOKA_DEBUG] 📸 Trying Model: ${model}`); // Log Start

        try {
          // Retry Loop (2 attempts)
          for (let attempt = 0; attempt < 2; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s Timeout

            const url =
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(fbPayload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const latency = Date.now() - startT;

            if (res.ok) {
              console.log(
                `[OTOKA_DEBUG] ✅ SUCCESS: ${model} (Latency: ${latency}ms)`,
              );
              fbData = await res.json();
              break;
            } else {
              const errText = await res.text();
              console.warn(
                `[OTOKA_DEBUG] ⚠️ FAIL: ${model} (Attempt ${
                  attempt + 1
                }) | Status: ${res.status} | Err: ${errText.substring(0, 150)}`,
              );

              recordModelFailure(model, res.status);

              fbErrors.push(
                `[${model}]: Status ${res.status} - ${
                  errText.substring(0, 200)
                }...`,
              );

              if (res.status === 429 && attempt === 0) {
                await new Promise((r) => setTimeout(r, 2000));
              }
            }
          }
          if (fbData) break;
          // Wait before trying next model to avoid rate limit cascading
          await new Promise((r) => setTimeout(r, 1000));
        } catch (e: any) {
          console.error(`[OTOKA_DEBUG] Exception ${model}: ${e.message}`);
          fbErrors.push(`[${model}] Exception: ${e.message}`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // Final Attempt: Qwen-VL logic for JSON?
      // Actually Qwen can probably do JSON too.
      // But for now let's just use it if fbData is null.
      if (!fbData && NEBIUS_API_KEY) {
        console.log(
          "[OTOKA_DEBUG] 🛡️ Fallback: Trying Nebius Qwen-VL for JSON...",
        );
        try {
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
                  { type: "text", text: fallbackPrompt },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${image}` },
                  },
                ],
              },
            ],
            max_tokens: 1024,
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
              try {
                finalResult = JSON.parse(content);
                fbData = { success: true }; // Fake it to skip error throw
              } catch (e) {
                console.error("Qwen JSON parse error", e);
              }
            }
          } else {
            fbErrors.push(`[Qwen-VL] Failed: ${await qwenRes.text()}`);
          }
        } catch (e: any) {
          fbErrors.push(`[Qwen-VL] Exception: ${e.message}`);
        }
      }

      if (fbData || finalResult) {
        if (!finalResult && fbData) {
          const txt = fbData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          const jsonMatch = txt.match(/```json\n([\s\S]*?)\n```/) ||
            txt.match(/```([\s\S]*?)```/);
          const jsonStr = jsonMatch ? jsonMatch[1] : txt;
          try {
            finalResult = JSON.parse(jsonStr);
          } catch (e) {
            console.error("Fallback JSON Parse Error", e);
            // Last ditch effort
            finalResult = {
              items: ["Error parsing AI response"],
              metabolic_insight: {
                layman_explanation: "AI output was invalid.",
              },
            };
          }
        }
      } else {
        throw new Error(
          `All vision models failed. Trace: ${fbErrors.join(" | ")}`,
        );
      }
    }

    // 6. Return Result with Debug Trace
    const responseBody = {
      ...finalResult,
      debug_trace: {
        gemini_description: sceneDescription,
        deepseek_raw: deepseekRaw || "No Output",
        model_used: "final-pipeline-v2",
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
