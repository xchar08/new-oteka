"use server";

import { stripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/client"; // This might be wrong for server actions, let's use a server-friendly verify
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createCheckoutSession(priceId: string) {
    const cookieStore = await cookies();

    // Create a supabase client for the server action
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    // Server actions shouldn't set cookies usually, but auth needs it.
                    // For reading user, getAll is enough.
                },
            },
        },
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("You must be logged in to subscribe.");
    }

    // Define success/cancel URLs
    const headersList = await headers();
    const origin = headersList.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        metadata: {
            userId: user.id,
        },
        success_url: `${origin}/dashboard?payment=success`,
        cancel_url: `${origin}/pricing?payment=cancelled`,
        customer_email: user.email,
    });

    if (!session.url) {
        throw new Error("Failed to create checkout session");
    }

    redirect(session.url);
}
