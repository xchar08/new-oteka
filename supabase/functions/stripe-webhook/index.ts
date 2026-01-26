// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno&no-check";

const STRIPE_API_KEY = Deno.env.get("STRIPE_API_KEY") ?? "";           // ✅ NOT PUBLIC
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? ""; // ✅ NOT PUBLIC

const stripe = new Stripe(STRIPE_API_KEY, {
  apiVersion: "2024-11-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (request: Request) => {
  try {
    const signature = request.headers.get("Stripe-Signature");
    if (!signature) {
      return new Response("Missing Stripe-Signature header", { status: 400 });
    }

    // Raw body is required for signature verification
    const body = await request.text();

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET,
        undefined,
        cryptoProvider
      );
    } catch (err: any) {
      console.error("Stripe signature verification failed:", err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id; // You set this when creating the Checkout Session
        
        console.log("Checkout completed for user:", userId);
        
        // TODO: Write to Supabase (grant premium, etc.)
        // Example:
        /*
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          { global: { headers: {} } }
        );
        await supabase.from('subscriptions').insert({...});
        */
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Stripe only needs a 2xx response
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Stripe webhook handler error:", err.message);
    return new Response(`Internal Error: ${err.message}`, { status: 500 });
  }
});
