import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NEBIUS_API_KEY = Deno.env.get("NEBIUS_API_KEY") || "";
const NEBIUS_BASE_URL = Deno.env.get("NEBIUS_BASE_URL") || "";

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
    const query = body?.query || "";
    const context = body?.context || "chat";
    const baseUrl = NEBIUS_BASE_URL.replace(/\/$/, "");

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

    const recentMeals = logs?.map((l: any) =>
      `- ${l.metabolic_tags_json?.item} (${l.metabolic_tags_json?.calories}kcal, ${l.metabolic_tags_json?.protein}g P)`
    ).join("\n") || "No recent meals recorded.";

    const systemPrompt = `
      You are Oteka, an elite Metabolic Advisor.
      
      ## USER PROFILE
      - Goal: ${goal.toUpperCase()}
      
      ## SAFETY PROTOCOLS (CRITICAL)
      The user has the following medical constraints. You MUST adhere to these at all times.
      ${safetyProtocols}
      
      ## RECENT INTAKE (Last 24h)
      ${recentMeals}

      ## INSTRUCTION
      Provide concise, actionable advice based on the user's query: "${query}".
      If they ask about food, filter your recommendations through the Safety Protocols.
      Do not mention the protocols explicitly unless they prevent a specific action.
      Keep it under 3 sentences unless asked for a plan.
    `;

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${NEBIUS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-R1", // Using standard R1 or fallback
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: query || "What should I eat next?" },
        ],
        temperature: 0.6,
        max_tokens: 500,
      }),
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      // Fallback response if AI fails
      return new Response(
        JSON.stringify({
          advice:
            "I'm having trouble accessing my neural core. Please check your network.",
          error: errorText,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiData = await aiRes.json();
    let advice = aiData.choices?.[0]?.message?.content ||
      "Focus on your macros.";

    // Remove DeepSeek reasoning blocks <think>...</think>
    advice = advice.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    // Cleanup quotes if any
    advice = advice.replace(/^["']|["']$/g, "").trim();

    return new Response(
      JSON.stringify({ advice, version: "v8-medical-safety" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
