import { createClient } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/utils/errors';

const getSupabase = () => createClient();

export interface PlanPrice {
  priceId: string;
  amountCents: number | null;
  currency: string;
}

export type PlanCatalog = Record<'pro' | 'coach', Partial<Record<'month' | 'year', PlanPrice>>>;

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

  /**
   * Reads purchasable Stripe prices from the plans table (the single source
   * of truth the checkout function validates against). Keyed by plan type
   * then billing interval; missing keys mean that variant isn't configured.
   */
  async getPlans(): Promise<PlanCatalog> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('plans')
      .select('price_id, plan_type, billing_interval, amount_cents, currency')
      .eq('active', true)
      .order('sort_order');

    if (error) throw normalizeError(error);

    const catalog: PlanCatalog = { pro: {}, coach: {} };
    for (const row of data || []) {
      const t = row.plan_type as 'pro' | 'coach';
      const i = (row.billing_interval as 'month' | 'year') || 'month';
      if (!catalog[t][i]) {
        catalog[t][i] = {
          priceId: row.price_id,
          amountCents: row.amount_cents ?? null,
          currency: row.currency || 'usd',
        };
      }
    }
    return catalog;
  },

  /** Coach-plan owners: join code + seat usage (creates the team lazily). */
  async getMyCoachTeam(): Promise<{ join_code: string; seat_limit: number; seats_used: number }> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_my_coach_team');
    if (error) throw normalizeError(error);
    return data;
  },

  /** Athletes: claim a seat on a coach's team with their join code. */
  async joinCoachTeam(code: string): Promise<{ plan: string; team_owner: string }> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('join_coach_team', { p_code: code });
    if (error) throw normalizeError(error);
    return data;
  },

  /**
   * Redeems a voucher code for a time-limited premium pass.
   * Validation, locking and plan changes happen server-side (RPC).
   */
  async redeemVoucher(code: string): Promise<{ plan: string; expires_at: string; days_granted: number }> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('redeem_voucher', { p_code: code });
    if (error) throw normalizeError(error);
    return data;
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
