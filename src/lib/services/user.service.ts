import { createClient } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/utils/errors';

const getSupabase = () => createClient();

export const userService = {
  /**
   * Updates the user's metabolic profile safely by merging with existing state.
   */
  async updateProfile(userId: string, updates: {
    display_name?: string;
    metabolic_state_json?: any;
    calorie_target?: number;
    hand_width_mm?: number;
  }) {
    const supabase = getSupabase();
    
    // 1. Fetch current state to ensure safe merge if JSON is provided
    const { data: existing } = await supabase
        .from('users')
        .select('metabolic_state_json')
        .eq('id', userId)
        .single();

    const finalUpdates: any = { 
        ...updates,
        updated_at: new Date().toISOString()
    };

    if (updates.metabolic_state_json) {
        finalUpdates.metabolic_state_json = {
            ...(existing?.metabolic_state_json || {}),
            ...updates.metabolic_state_json
        };
    }

    const { data, error } = await supabase
      .from('users')
      .update(finalUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw normalizeError(error);
    return data;
  },

  /**
   * Adds a food item to the user's "Neural Exclusions" list.
   * This is used by the metabolic optimizer to filter out disliked items.
   */
  async addRestriction(userId: string, foodName: string) {
    const supabase = getSupabase();
    const conditionId = `neural-block-${userId}`;

    // 1. Ensure the condition entry exists
    const { data: existingCond } = await supabase
        .from('conditions')
        .select('*')
        .eq('id', conditionId)
        .single();

    let neverRecommend = existingCond?.never_recommend_json || [];
    if (!neverRecommend.includes(foodName)) {
        neverRecommend.push(foodName);
    }

    const { error: condError } = await supabase
        .from('conditions')
        .upsert({
            id: conditionId,
            name: `Neural Block (User Dislikes)`,
            category: 'Personal',
            never_recommend_json: neverRecommend,
            rules_json: {}
        });

    if (condError) throw normalizeError(condError);

    // 2. Link to user if not already linked
    const { error: linkError } = await supabase
        .from('user_conditions')
        .upsert({
            user_id: userId,
            condition_id: conditionId
        }, { onConflict: 'user_id, condition_id' });

    if (linkError) throw normalizeError(linkError);

    return true;
  }
};
