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

        const startTime = Date.now();
        console.log(`[OTOKA_DEBUG] 🛒 Shopping Gen Start. User: ${user.id}`);

        // 1. Fetch User Conditions for AI Context
        const { data: userConditions } = await supabase
            .from("user_conditions")
            .select("conditions(name, diet_impact)")
            .eq("user_id", user.id);
        
        const conditionContext = (userConditions || []).map((uc: any) => uc.conditions.name).join(", ");

        // 2. RUN THE DETERMINISTIC ALGORITHM
        const optimizeRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/optimize-meals`, {
            method: "POST",
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                constraints: { 
                    strictness: 1.0, 
                    use_preferences: true,
                    pop_size: 20,
                    generations: 10
                }
            })
        });

        const optimizeData = await optimizeRes.json();
        
        if (!optimizeData.success || !optimizeData.solutions || optimizeData.solutions.length === 0) {
            throw new Error("Optimization Algorithm failed to return meal suggestions.");
        }

        // 3. EXTRACT RESULTS
        const topSolution = optimizeData.solutions[0];
        const menuItems = topSolution.menu.join(", ");
        const stats = topSolution.stats;

        // 4. PREPARE THE ELITE RECIPE PROMPT
        const systemPrompt = `
            You are OTEKA, an elite Metabolic Logistics Engine.
            Algorithm selected these items: [${menuItems}].
            User Conditions: [${conditionContext}].
            Target: ${stats.calories}kcal, ${stats.protein}g Prot.

            Task: 
            1. Generate Shopping List for the items.
            2. Synthesize a 'Metabolic Recipe Pool' (2-3 recipes) using THESE EXACT ITEMS.
            3. For each recipe, provide a 'Bio-Reason' explaining how it helps their conditions.

            Return ONLY JSON:
            { 
              "suggestions": [{"name":string,"category":string,"reason":string,"priority":"high"|"medium"}], 
              "recipes": [{"title":string, "ingredients":[string], "instructions":[string], "bio_reason":string, "prep_time":string}],
              "analysis":string 
            }
        `;

        const NEBIUS_API_KEY = Deno.env.get("NEBIUS_API_KEY");
        const GEMINI_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");

        let result = { suggestions: [], recipes: [], analysis: "Analysis failed." };
        let success = false;

        // Try Gemini 2.5 Flash
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
                        success = true;
                    }
                }
            } catch (e) {
                console.error(`[OTOKA_DEBUG] 🛑 AI Translation failed:`, e);
            }
        }

        if (!success) throw new Error("AI Logistics Synthesis failed.");

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ failure: true, error: error.message }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
