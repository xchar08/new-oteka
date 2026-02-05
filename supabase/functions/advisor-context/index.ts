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

    // AI Logic
    const url = new URL(req.url);
    const context = url.searchParams.get("context") || "general";
    const baseUrl = NEBIUS_BASE_URL.replace(/\/$/, "");

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
            content:
              "You are a metabolic advisor. Be extremely concise. Response should be very short and high-impact.",
          },
          { role: "user", content: `Give me advice for: ${context}` },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      throw new Error(`Nebius Error (${aiRes.status}): ${errorText}`);
    }

    const aiData = await aiRes.json();
    let advice = aiData.choices?.[0]?.message?.content || "No advice.";

    // Remove DeepSeek reasoning blocks <think>...</think>
    advice = advice.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    return new Response(
      JSON.stringify({ advice, version: "v6-clean-output" }),
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
