import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-01-27.acacia" as any, // Cast to any to avoid type declaration mismatch with latest SDK
    typescript: true,
});
