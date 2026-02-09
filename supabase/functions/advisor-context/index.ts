import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Auth Header" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase Client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user || userError) {
      return new Response(
        JSON.stringify({
          error: `Auth Failed: ${userError?.message || "User not found"}`,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 0. Parse Request
    const { body } = await req.json();
    const context = body?.context || "chat";

    // 1. Fetch User Profile & Conditions
    const { data: profile } = await supabase
      .from("users")
      .select("metabolic_state_json, display_name, streak_count")
      .eq("id", user.id)
      .single();

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

    // 2. Fetch Recent Logs (Last 24h)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: logs } = await supabase
      .from("logs")
      .select("metabolic_tags_json, captured_at")
      .eq("user_id", user.id)
      .gte("captured_at", yesterday.toISOString())
      .order("captured_at", { ascending: false })
      .limit(10);

    // 3. Construct Context strings
    const goal = profile?.metabolic_state_json?.current_goal || "maintenance";

    // Format Conditions
    let safetyProtocols = "None (Standard Metabolic logic applies).";
    if (medicalContext && medicalContext.length > 0) {
      safetyProtocols = medicalContext.map((c: any) => {
        const cond = c.conditions;
        const avoid = Array.isArray(cond.never_recommend_json)
          ? cond.never_recommend_json.join(", ")
          : "";
        return `- **${cond.name}**: ${
          JSON.stringify(cond.rules_json)
        }. STRICTLY AVOID: ${avoid}`;
      }).join("\n");
    }

    // Format Logs
    let logSummary = "No recent food logs.";
    if (logs && logs.length > 0) {
      logSummary = logs.map((l: any) => {
        const m = l.metabolic_tags_json;
        return `- [${new Date(l.captured_at).getHours()}:00] ${
          m.item || "Food"
        } (${m.calories || 0}kcal)`;
      }).join("\n");
    }

    // 4. Construct Prompt
    const systemPrompt = `
      You are OTEKA, an elite Metabolic Advisor.
      User Goal: ${goal}
      Safety Protocols (CRITICAL):
      ${safetyProtocols}

      Recent Intake (24h):
      ${logSummary}

      Current Context: ${context} (User triggers this from Dashboard).

      Task: provide a SINGLE, concise 1-sentence observation or recommendation based on their recent intake and goal.
      Do not say "Hello". Jump straight to the insight.
      If their intake is empty, suggest a specific meal aligned with their goal.
      Strictly adhere to Safety Protocols.
    `;

    // 5. Call Hybrid Intelligence (DeepSeek -> Gemini)
    let advice = "Metabolic systems nominal.";
    let strategy = "unknown";
    let deepSeekSuccess = false;

    // A. Essential Config
    const NEBIUS_API_KEY = Deno.env.get("NEBIUS_API_KEY");
    // Explicit Model ID verified via API checklist
    const NEBIUS_MODEL = "deepseek-ai/DeepSeek-R1-0528";

    if (NEBIUS_API_KEY) {
      console.log(
        `[OTOKA_DEBUG] 🧠 Advisor: Attempting DeepSeek R1 (${NEBIUS_MODEL})...`,
      );
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s Timeout (R1 is slower thinking)

      try {
        const nebiusRes = await fetch(
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
                { role: "system", content: systemPrompt },
                { role: "user", content: "Analyze." },
              ],
              max_tokens: 1024, // Increased to prevent <think> truncation
              temperature: 0.6,
            }),
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (nebiusRes.ok) {
          const data = await nebiusRes.json();
          const rawContent = data.choices?.[0]?.message?.content || "";

          // LOG RAW for debugging
          console.log(
            `[OTOKA_DEBUG] Raw DeepSeek Content:`,
            rawContent.substring(0, 500),
          );

          // Clean <think> tags (handles unclosed tags + case insensitive + missing bracket)
          let cleanContent = rawContent.replace(
            /<think(?:>|\s)[\s\S]*?(?:<\/think>|$)/gi,
            "",
          ).trim();

          // Clean potential markdown code blocks if the model wrapped the plain text
          cleanContent = cleanContent.replace(
            /^```(json|text)?\n?|\n?```$/g,
            "",
          ).trim();

          advice = cleanContent || advice;

          if (!advice) advice = "Metabolic analysis complete.";

          strategy = "deepseek-r1-nebius";
          deepSeekSuccess = true;
          console.log(`[OTOKA_DEBUG] ✅ DeepSeek Success`);
        } else {
          const errText = await nebiusRes.text();
          const status = nebiusRes.status;
          // 404 = Model Not Found (Invalid ID), 400 = Bad Request, 500 = Server Error
          console.warn(
            `[OTOKA_DEBUG] ⚠️ DeepSeek Failed: ${status} | ${
              errText.substring(0, 100)
            }`,
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[OTOKA_DEBUG] ⚠️ DeepSeek Exception: ${msg}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // B. Fallback to Gemini
    // ... (rest of code)
    if (!deepSeekSuccess) {
      // ... (rest of Gemini fallback code)
    }

    // ... (rest of logic)

    // 6. Return Result
    return new Response(
      JSON.stringify({
        advice,
        meta: { strategy, timestamp: new Date().toISOString() },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const errObj = error instanceof Error ? error : new Error(String(error));
    console.error("Advisor Error:", errObj);
    // SOFT FAIL: Return 200 with default advice to prevent client crash
    return new Response(
      JSON.stringify({
        advice: "Metabolic systems nominal. (Network optimization in progress)",
        error: errObj.message,
        debug_meta: { timestamp: new Date().toISOString() },
      }),
      {
        status: 200, // Force 200 OK
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
