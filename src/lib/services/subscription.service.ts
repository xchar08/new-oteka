import { createClient } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/utils/errors';

const getSupabase = () => createClient();

export const subscriptionService = {
  /**
   * Creates a Stripe Checkout Session for upgrading to Pro.
   */
  async createCheckoutSession(userId: string, priceId: string) {
    const supabase = getSupabase();
    
    // Call our Edge Function
    try {
        console.log("[SubscriptionService] Invoking create-checkout-session with:", { priceId });
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
          body: {
            priceId,
            successUrl: `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/pricing`,
          },
        });

        if (error) {
            console.error("[SubscriptionService] Edge Function Error:", error);
            throw error;
        }
        
        console.log("[SubscriptionService] Checkout URL created:", data?.url);
        return data; // contains the checkout URL
    } catch (e) {
        console.error("[SubscriptionService] Full Exception:", e);
        throw normalizeError(e);
    }
  },

  async getSubscriptionStatus(userId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw normalizeError(error);
    return data;
  }
};
