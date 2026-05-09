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
  }
};
