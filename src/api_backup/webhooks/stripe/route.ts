import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Admin client for writing to subscriptions table bypassing RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("Stripe-Signature") as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!,
        );
    } catch (error: any) {
        console.error("Webhook signature verification failed.", error.message);
        return new NextResponse("Webhook error", { status: 400 });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    if (event.type === "checkout.session.completed") {
        const subscriptionId = session.subscription as string;
        const userId = session.metadata?.userId;

        if (!userId || !subscriptionId) {
            return new NextResponse("Missing metadata", { status: 400 });
        }

        const subscription = await stripe.subscriptions.retrieve(
            subscriptionId,
        );

        await supabaseAdmin.from("subscriptions").upsert({
            id: subscription.id,
            user_id: userId,
            status: subscription.status,
            price_id: subscription.items.data[0].price.id,
            current_period_end: new Date(
                (subscription as any).current_period_end * 1000,
            )
                .toISOString(),
        });
    }

    if (event.type === "invoice.payment_succeeded") {
        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(
            subscriptionId,
        );

        await supabaseAdmin.from("subscriptions").update({
            status: subscription.status,
            current_period_end: new Date(
                (subscription as any).current_period_end * 1000,
            )
                .toISOString(),
        }).eq("id", subscriptionId);
    }

    return new NextResponse("Received", { status: 200 });
}
