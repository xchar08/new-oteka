import { createClient } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/utils/errors';

const getSupabase = () => createClient();

export const subscriptionService = {
  /**
   * Mock upgrade for development/demonstration.
   * In a real app, this would be handled via Stripe Webhooks.
   */
  async upgradeToPro(userId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .update({ plan: 'pro' })
      .eq('id', userId)
      .select()
      .single();

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
