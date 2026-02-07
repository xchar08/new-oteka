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
      const debugMsg = userError?.message || "User object is null";
      const tokenSnippet = authHeader.replace("Bearer ", "").substring(0, 10) +
        "...";
      return new Response(
        JSON.stringify({
          error: `Auth Failed: ${debugMsg} | Token: ${tokenSnippet}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 0. Parse Request
    const url = new URL(req.url);
    const context = url.searchParams.get("context") || "general";
    const baseUrl = NEBIUS_BASE_URL.replace(/\/$/, "");

    // 1. Fetch User Profile
    const { data: profile } = await supabase
      .from("users")
      .select("metabolic_state_json, display_name, streak_count")
      .eq("id", user.id)
      .single();

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

    // 3. Construct Context
    const goal = profile?.metabolic_state_json?.current_goal || "maintenance";
    const recentMeals = logs?.map((l: any) =>
      `- ${l.metabolic_tags_json?.item} (${l.metabolic_tags_json?.calories}kcal)`
    ).join("\n") || "No recent meals recorded.";

    const systemPrompt = `
      You are an elite Metabolic Advisor for Oteka.
      User Goal: ${goal.toUpperCase()}.
      Recent Activity:
      ${recentMeals}

      Current Context: ${context}

      Task: Provide ONE high-impact, actionable sentence of advice based on their recent intake and goal. 
      Do not be generic. Be specific, slightly scientific but accessible. 
      If they haven't eaten, tell them what to eat next for their goal.
    `;

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${NEBIUS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-R1-0528-fast",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: "Generate advice." },
        ],
        temperature: 0.6,
      }),
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      throw new Error(`Nebius Error (${aiRes.status}): ${errorText}`);
    }

    const aiData = await aiRes.json();
    let advice = aiData.choices?.[0]?.message?.content ||
      "Focus on your macros today.";

    // Remove DeepSeek reasoning blocks <think>...</think>
    advice = advice.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Cleanup quotes if any
    advice = advice.replace(/^["']|["']$/g, "");

    return new Response(
      JSON.stringify({ advice, version: "v7-context-aware" }),
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
