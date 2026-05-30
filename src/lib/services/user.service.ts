import { createClient } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/utils/errors';
import { UserTasteProfile } from '@/lib/types/metabolic';
import { getFoodTasteProfile, updateTasteProfileFromFeedback } from '@/lib/engine/taste/taste-engine';

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
  },

  /**
   * Updates the user's taste profile preferences.
   */
  async updateTasteProfile(userId: string, tasteProfile: UserTasteProfile) {
    const supabase = getSupabase();
    
    // Validate that the authenticated user matches the userId being updated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
      throw new Error('Unauthorized: Cannot update taste profile for another user.');
    }

    const { data, error } = await supabase
      .from('users')
      .upsert({ 
        id: userId,
        taste_profile_json: tasteProfile 
      }, { onConflict: 'id' })
      .select('taste_profile_json');

    if (error) throw normalizeError(error);
    return data?.[0]?.taste_profile_json;
  },

  /**
   * Refines the user's taste profile based on feedback for a specific food.
   */
  async refineTasteFromFeedback(userId: string, foodName: string, tasteRating: number) {
    // 1. Get the food's taste vector
    const foodTaste = getFoodTasteProfile(foodName);
    if (!foodTaste) return null; // Can't learn if we don't know the food's taste

    const supabase = getSupabase();

    // 2. Fetch current taste profile
    const { data: user } = await supabase
      .from('users')
      .select('taste_profile_json')
      .eq('id', userId)
      .single();

    const currentProfile: UserTasteProfile = user?.taste_profile_json || {
      sweet: 0.5, bitter: 0.5, sour: 0.5, umami: 0.5, confidence: 0
    };

    // 3. Calculate new profile
    const updatedProfile = updateTasteProfileFromFeedback(currentProfile, foodTaste, tasteRating);

    // 4. Save to DB
    return await this.updateTasteProfile(userId, updatedProfile);
  }
};
