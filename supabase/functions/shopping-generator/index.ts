import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    // Handle Preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");

        // DEBUG: Log Auth Header (Masked)
        if (authHeader) {
            console.log(
                `[OTOKA_DEBUG] Auth Header: ${
                    authHeader.substring(0, 20)
                }... (Length: ${authHeader.length})`,
            );
        } else {
            console.log(`[OTOKA_DEBUG] Auth Header: MISSING`);
        }

        if (!authHeader) {
            return new Response(
                JSON.stringify({
                    failure: true,
                    error: "Missing Auth Header",
                }),
                {
                    status: 200, // Bypass client error throwing
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        // Create Supabase Client
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } },
        );

        const { data: { user }, error: userError } = await supabase.auth
            .getUser();

        if (!user || userError) {
            console.error(`[OTOKA_DEBUG] getUser Error:`, userError);
            return new Response(
                JSON.stringify({
                    failure: true,
                    error: `Auth Failed (Len: ${authHeader.length}): ${
                        userError?.message || "User not found"
                    }`,
                    details: userError,
                }),
                {
                    status: 200, // Bypass client error throwing
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        // 1. Fetch Household & Members
        const { data: userData } = await supabase
            .from("users")
            .select("household_id")
            .eq("id", user.id)
            .single();

        const hId = userData?.household_id;
        const memberIds = [user.id];

        if (hId) {
            const { data: members } = await supabase
                .from("users")
                .select("id")
                .eq("household_id", hId);
            if (members) memberIds.push(...members.map(m => m.id).filter(id => id !== user.id));
        }

        // 2. Fetch Context Data (AGGREGATED)
        // A. Profiles (Goals)
        const { data: profiles } = await supabase
            .from("users")
            .select("metabolic_state_json, display_name")
            .in("id", memberIds);

        // B. Medical Conditions
        const { data: medicalContext } = await supabase
            .from("user_conditions")
            .select(`
                user_id,
                conditions (
                    name,
                    rules_json,
                    never_recommend_json
                )
            `)
            .in("user_id", memberIds);

        // C. Household Pantry Inventory
        const { data: pantry } = await supabase
            .from("pantry")
            .select("foods(name), metadata_json, probability_score")
            .eq("status", "active")
            .or(`user_id.in.(${memberIds.join(',')}), household_id.eq.${hId || '00000000-0000-0000-0000-000000000000'}`);

        // 3. Prepare Context Strings
        const goals = profiles?.map(p => `${p.display_name}: ${p.metabolic_state_json?.current_goal || 'maintenance'}`).join(", ") || "Maintenance";

        let safetyContext = "None.";
        if (medicalContext && medicalContext.length > 0) {
            safetyContext = medicalContext.map((c: any) => {
                const cond = c.conditions;
                const avoid = Array.isArray(cond.never_recommend_json)
                    ? cond.never_recommend_json.join(", ")
                    : "";
                return `- **${cond.name}** (Member Profile): Rules [${
                    JSON.stringify(cond.rules_json)
                }]. NEGATIVE INGREDIENTS: [${avoid}]`;
            }).join("\n");
        }

        let inventoryContext = "Pantry is empty.";
        if (pantry && pantry.length > 0) {
            inventoryContext = pantry.map((p: any) => {
                return `- ${p.foods?.name || "Item"} (${
                    (p.probability_score * 100).toFixed(0)
                }% full)`;
            }).join("\n");
        }

        // 4. Construct Prompt (DeepSeek R1)
        const systemPrompt = `
      You are OTEKA, an elite Household Metabolic Logistics Engine.
      Household Goals: ${goals}
      
      ## INVENTORY (Do NOT suggest what they already have):
      ${inventoryContext}

      ## MEDICAL SAFETY (CRITICAL - STRICT FILTERS for EVERY member):
      ${safetyContext}

      Task: Generate a shopping list for 3 days of optimal eating for the ENTIRE HOUSEHOLD.
      - Satisfy all nutritional gaps across different member goals.
      - Ensure NO suggestions contain ingredients harmful to ANY member (STRICT MEDICAL FILTER).
      - If one member is Keto and another is Muscle Gain, suggest items that bridge both or distinct items for each.

      Return ONLY JSON:
      {
        "suggestions": [
            {
                "name": "Spinach",
                "category": "Produce",
                "reason": "Magnesium gap fill for sleep support; Iron for muscle oxygenation.",
                "priority": "high"
            }
        ],
        "analysis": "Brief 1-sentence summary of the shared household gaps."
      }
    `;

        // 4. Call Intelligence
        const NEBIUS_API_KEY = Deno.env.get("NEBIUS_API_KEY");
        const GEMINI_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
        // Standardized DeepSeek Model ID (Verified Working)
        const NEBIUS_MODEL = "deepseek-ai/DeepSeek-V3.2";

        console.log(`[OTOKA_DEBUG] 🛒 Shopping Gen Start. User: ${user.id}`);
        console.log(
            `[OTOKA_DEBUG] 🛒 Context - Conditions: ${
                medicalContext?.length || 0
            }, Pantry: ${pantry?.length || 0}`,
        );

        let result = { suggestions: [], analysis: "Analysis failed." };
        let strategy = "unknown";
        let success = false;

        // A. Try Gemini 2.5 Flash (Primary)
        if (GEMINI_API_KEY) {
            console.log(
                `[OTOKA_DEBUG] 🛒 Shopping: Attempting Gemini 2.5 Flash (Primary)...`,
            );
            try {
                const url =
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: systemPrompt }] }],
                        generationConfig: {
                            responseMimeType: "application/json",
                        },
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    let txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (txt) {
                        // Clean Markdown
                        const jsonMatch =
                            txt.match(/```json\n([\s\S]*?)\n```/) ||
                            txt.match(/```([\s\S]*?)```/);
                        if (jsonMatch) {
                            txt = jsonMatch[1];
                        }

                        result = JSON.parse(txt);
                        strategy = "gemini-2.5-flash";
                        success = true;
                        console.log(`[OTOKA_DEBUG] ✅ Gemini Success`);
                    }
                } else {
                    const errText = await res.text();
                    console.error(
                        `[OTOKA_DEBUG] 🛑 Gemini Primary Failed: ${res.status}`,
                        errText,
                    );
                    throw new Error(
                        `Gemini Primary Failed (${res.status}): ${
                            errText.substring(0, 100)
                        }`,
                    );
                }
            } catch (e) {
                console.error(`[OTOKA_DEBUG] 🛑 Gemini Exception:`, e);
            }
        }

        // B. Fallback to DeepSeek R1 (Nebius)
        if (!success && NEBIUS_API_KEY) {
            console.log(
                `[OTOKA_DEBUG] 🛒 Shopping: Fallback to DeepSeek R1...`,
            );
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for massive context reasoning

                const res = await fetch(
                    "https://api.studio.nebius.ai/v1/chat/completions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${NEBIUS_API_KEY}`,
                        },
                        body: JSON.stringify({
                            model: NEBIUS_MODEL,
                            messages: [
                                {
                                    role: "system",
                                    content:
                                        "You are a JSON-only Metabolic Logistics Engine. Return valid JSON only.",
                                },
                                { role: "user", content: systemPrompt },
                            ],
                            max_tokens: 1500, // Large output window
                            temperature: 0.3,
                        }),
                        signal: controller.signal,
                    },
                );
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    let content = data.choices?.[0]?.message?.content || "{}";

                    console.log(
                        `[OTOKA_DEBUG] 🛒 DeepSeek Raw: ${
                            content.substring(0, 200)
                        }...`,
                    );

                    // Clean <think> tags from R1 output
                    content = content.replace(/<think>[\s\S]*?<\/think>/g, "")
                        .replace(/<think(?:>|\s)[\s\S]*?(?:<\/think>|$)/gi, "")
                        .trim();

                    // Extract JSON: Support Markdown, Raw, or Wrapped
                    let jsonStr = "";
                    const jsonMatch =
                        content.match(/```json\n([\s\S]*?)\n```/) ||
                        content.match(/```([\s\S]*?)```/);

                    if (jsonMatch) {
                        jsonStr = jsonMatch[1];
                    } else {
                        // Try Raw JSON (Bracket matching)
                        const start = content.indexOf("{");
                        const end = content.lastIndexOf("}");
                        if (start >= 0 && end > start) {
                            jsonStr = content.substring(start, end + 1);
                        } else {
                            jsonStr = content;
                        }
                    }

                    try {
                        result = JSON.parse(jsonStr);
                        strategy = "deepseek-r1-fallback";
                        success = true;
                        console.log(
                            `[OTOKA_DEBUG] ✅ DeepSeek Fallback Success`,
                        );
                    } catch (e) {
                        console.error(
                            `[OTOKA_DEBUG] ⚠️ DeepSeek JSON Parse Fail: ${
                                (e as any).message
                            }`,
                        );
                        console.error(
                            `[OTOKA_DEBUG] Bad JSON: ${
                                jsonStr.substring(0, 200)
                            }`,
                        );
                    }
                } else {
                    const errText = await res.text();
                    console.warn(
                        `[OTOKA_DEBUG] ⚠️ DeepSeek HTTP Error: ${res.status}`,
                        errText,
                    );
                    // Don't throw here, just let it fail silently as it's the last fallback
                }
            } catch (e) {
                console.warn(`[OTOKA_DEBUG] ⚠️ DeepSeek Exception:`, e);
            }
        }

        if (!success) {
            console.error("[OTOKA_DEBUG] ❌ All models failed.");
            // Return 200 with error details to bypass client-side generic error handling
            return new Response(
                JSON.stringify({
                    failure: true,
                    error: "All AI models failed. Check logs.",
                    meta: { strategy: "none" },
                }),
                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        // 5. Return
        return new Response(JSON.stringify({ ...result, meta: { strategy } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error(`[OTOKA_DEBUG] 🚨 Fatal Error:`, error);
        // Return 200 with error details to bypass client-side generic error handling
        return new Response(
            JSON.stringify({
                failure: true,
                error: error.message || "Unknown Error",
                details: error.stack,
            }),
            {
                status: 200, // CHANGED FROM 500
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }
});
