// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_API_KEY = Deno.env.get("STRIPE_API_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const subscriptionId = session.subscription as string;

        if (userId) {
          console.log("Checkout completed for user:", userId);
          
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          // Determine plan type from session metadata (defaults to 'pro' for backward compat)
          const planType = session.metadata?.plan_type || 'pro';
          console.log("Plan type from metadata:", planType);

          // Update user plan
          await supabase
            .from('users')
            .update({ plan: planType })
            .eq('id', userId);

          // Upsert into subscriptions table (handles duplicate webhook events)
          await supabase.from('subscriptions').upsert({
            id: subscriptionId,
            user_id: userId,
            status: subscription.status,
            price_id: subscription.items.data[0].price.id,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          }, { onConflict: 'id' });
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription updated:", subscription.id);
        
        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('id', subscription.id);
        
        // If subscription is no longer active, downgrade user
        if (['canceled', 'incomplete_expired', 'past_due', 'unpaid'].includes(subscription.status)) {
            const { data: subData } = await supabase
                .from('subscriptions')
                .select('user_id')
                .eq('id', subscription.id)
                .single();
            
            if (subData) {
                await supabase
                    .from('users')
                    .update({ plan: 'free' })
                    .eq('id', subData.user_id);
            }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription deleted:", subscription.id);
        
        const { data: subData } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('id', subscription.id)
            .single();
        
        if (subData) {
            await supabase
                .from('users')
                .update({ plan: 'free' })
                .eq('id', subData.user_id);
                
            await supabase
                .from('subscriptions')
                .delete()
                .eq('id', subscription.id);
        }
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Stripe webhook handler error:", err.message);
    return new Response(`Internal Error: ${err.message}`, { status: 500 });
  }
});
