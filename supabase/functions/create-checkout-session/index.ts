// @ts-nocheck — the stripe import uses esm.sh's `?no-check` (Stripe's types
// target Node and don't check under Deno), so editors infer minified garbage
// types ("type 'o'") for it. Runtime and deploy are unaffected.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_API_KEY = Deno.env.get("STRIPE_API_KEY") ?? "";
const stripe = new Stripe(STRIPE_API_KEY, {
  apiVersion: "2024-11-20",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Auth Header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user || userError) {
      throw new Error("Auth Failed");
    }

    const { priceId, successUrl, cancelUrl } = await req.json();

    // SERVER-SIDE VALIDATION: the priceId must exist in the plans table
    // (single source of truth, service-role managed) — prevents price
    // manipulation and removes hardcoded price IDs from the codebase.
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("plan_type, seat_count")
      .eq("price_id", priceId)
      .eq("active", true)
      .single();

    if (planError || !plan) {
      throw new Error("This plan isn't available. If you're the operator: insert your Stripe Price IDs into the `plans` table.");
    }

    // Redirect URLs come from the client; pin them to known origins so a
    // forged request can't bounce a real checkout to an attacker's site.
    // ALLOWED_CHECKOUT_ORIGINS: comma-separated origins, e.g.
    //   "https://app.oteka.com,http://localhost:3000,https://localhost"
    const allowedOrigins = (Deno.env.get("ALLOWED_CHECKOUT_ORIGINS") ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const assertAllowedRedirect = (raw: string, label: string) => {
      const url = new URL(raw); // throws on garbage
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(`${label} must be http(s)`);
      }
      if (allowedOrigins.length > 0 && !allowedOrigins.includes(url.origin)) {
        throw new Error(`${label} origin not allowed`);
      }
    };
    assertAllowedRedirect(successUrl, "successUrl");
    assertAllowedRedirect(cancelUrl, "cancelUrl");
    if (allowedOrigins.length === 0) {
      console.warn("[checkout] ALLOWED_CHECKOUT_ORIGINS not set — accepting any http(s) redirect origin");
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: plan.seat_count,
        },
      ],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      metadata: {
        plan_type: plan.plan_type,
        seat_count: String(plan.seat_count),
      },
    });

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
