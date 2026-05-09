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

        if (!authHeader) {
            return new Response(JSON.stringify({ failure: true, error: "Missing Auth Header" }), {
                status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } },
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (!user || userError) {
            return new Response(JSON.stringify({ failure: true, error: "Auth Failed" }), {
                status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        console.log(`[OTOKA_DEBUG] 🛒 Shopping Gen Start. User: ${user.id}`);

        // 1. RUN THE DETERMINISTIC ALGORITHM FIRST
        // We invoke the internal optimize-meals function to do the math.
        const optimizeRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/optimize-meals`, {
            method: "POST",
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                constraints: { strictness: 1.0, use_preferences: true }
            })
        });

        const optimizeData = await optimizeRes.json();
        
        if (!optimizeData.success || !optimizeData.solutions || optimizeData.solutions.length === 0) {
            throw new Error("Optimization Algorithm failed to return meal suggestions.");
        }

        // 2. EXTRACT THE MATHEMATICAL RESULTS
        const topSolution = optimizeData.solutions[0];
        const menuItems = topSolution.menu.join(", ");
        const stats = topSolution.stats;

        // 3. PREPARE THE PROMPT FOR THE LLM (Explanation Only)
        const systemPrompt = `
      You are OTEKA, an elite Household Metabolic Logistics Engine.
      
      ## ALGORITHMIC RESULTS
      The internal optimization algorithm has selected the following menu items to fill the user's nutritional gaps and minimize pantry waste:
      [ ${menuItems} ]

      ## TARGET ACHIEVED
      - Calories: ${stats.calories}
      - Protein: ${stats.protein}g
      - Magnesium: ${stats.magnesium}mg
      - Iron: ${stats.iron}mg

      Task: Generate a shopping list based ON THESE EXACT ITEMS.
      - Do not hallucinate new ingredients. Just extract the core ingredients needed for these meals.
      - Provide a brief 1-sentence 'reason' explaining why these items are nutritionally optimal (e.g. 'Magnesium gap fill').

      Return ONLY JSON:
      {
        "suggestions": [
            {
                "name": "Spinach",
                "category": "Produce",
                "reason": "Magnesium gap fill for sleep support.",
                "priority": "high"
            }
        ],
        "analysis": "Brief 1-sentence summary of why this specific menu fills the gaps."
      }
    `;

        // 4. Call Intelligence for Translation
        const NEBIUS_API_KEY = Deno.env.get("NEBIUS_API_KEY");
        const GEMINI_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
        const NEBIUS_MODEL = "deepseek-ai/DeepSeek-V3.2";

        let result = { suggestions: [], analysis: "Analysis failed." };
        let strategy = "unknown";
        let success = false;

        // A. Try Gemini 2.5 Flash (Primary for formatting)
        if (GEMINI_API_KEY) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: systemPrompt }] }],
                        generationConfig: { responseMimeType: "application/json" },
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    let txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (txt) {
                        result = JSON.parse(txt);
                        strategy = "gemini-2.5-flash-translator";
                        success = true;
                    }
                }
            } catch (e) {
                console.error(`[OTOKA_DEBUG] 🛑 Gemini Exception:`, e);
            }
        }

        // B. Fallback to DeepSeek R1
        if (!success && NEBIUS_API_KEY) {
            try {
                const res = await fetch("https://api.studio.nebius.ai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${NEBIUS_API_KEY}` },
                    body: JSON.stringify({
                        model: NEBIUS_MODEL,
                        messages: [
                            { role: "system", content: "You are a JSON formatter." },
                            { role: "user", content: systemPrompt },
                        ],
                        max_tokens: 1500,
                        temperature: 0.3,
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    let content = data.choices?.[0]?.message?.content || "{}";
                    content = content.replace(/<think(?:>|\s)[\s\S]*?(?:<\/think>|$)/gi, "").trim();
                    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```([\s\S]*?)```/);
                    let jsonStr = jsonMatch ? jsonMatch[1] : content.substring(content.indexOf("{"), content.lastIndexOf("}") + 1);
                    
                    result = JSON.parse(jsonStr);
                    strategy = "deepseek-r1-translator";
                    success = true;
                }
            } catch (e) {
                console.warn(`[OTOKA_DEBUG] ⚠️ DeepSeek Exception:`, e);
            }
        }

        if (!success) {
            return new Response(JSON.stringify({ failure: true, error: "All AI models failed." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ ...result, meta: { strategy } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error(`[OTOKA_DEBUG] 🚨 Fatal Error:`, error);
        return new Response(JSON.stringify({ failure: true, error: error.message }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
