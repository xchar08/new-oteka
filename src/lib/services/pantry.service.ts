import { createClient } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/utils/errors';

const getSupabase = () => createClient();

export const pantryService = {
  async getPantry(userId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('pantry')
      .select('*, foods(name, category_decay_rate)')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw normalizeError(error);
    return data;
  },

  async verifyItem(pantryId: number, status: 'active' | 'consumed', currentMetadata: any = {}, fraction?: number) {
    const supabase = getSupabase();
    
    const updateData: any = {
      status,
      last_verified_at: new Date().toISOString(),
    };

    if (fraction !== undefined) {
      updateData.metadata_json = { ...currentMetadata, remaining_fraction: fraction };
    }

    const { data, error } = await supabase
      .from('pantry')
      .update(updateData)
      .eq('id', pantryId)
      .select()
      .single();

    if (error) throw normalizeError(error);
    return data;
  },

  /** Permanently remove a pantry item (e.g. added by mistake). */
  async deleteItem(pantryId: number) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('pantry')
      .delete()
      .eq('id', pantryId);

    if (error) throw normalizeError(error);
    return true;
  },

  /** Search the global foods table by name (for autocomplete). */
  async searchFoods(query: string, limit = 10) {
    if (!query || query.trim().length < 2) return [];
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('foods')
      .select('id, name, nutritional_info, category_decay_rate')
      .ilike('name', `%${query.trim()}%`)
      .limit(limit);

    if (error) throw normalizeError(error);
    return data || [];
  },

  /** Look up a single food by exact or fuzzy name match. Returns the best match or null. */
  async lookupFoodByName(name: string): Promise<{ id: number; name: string; nutritional_info: any } | null> {
    if (!name) return null;
    const supabase = getSupabase();
    
    // Try exact match first (case-insensitive)
    const { data: exact } = await supabase
      .from('foods')
      .select('id, name, nutritional_info')
      .ilike('name', name.trim())
      .limit(1);

    if (exact && exact.length > 0) return exact[0];

    // Try fuzzy/contains match
    const { data: fuzzy } = await supabase
      .from('foods')
      .select('id, name, nutritional_info')
      .ilike('name', `%${name.trim()}%`)
      .limit(1);

    return fuzzy && fuzzy.length > 0 ? fuzzy[0] : null;
  },

  /** Add an item to the pantry with proper food_id linkage. */
  async addItem(userId: string, householdId: string | null, name: string, foodId?: number) {
    const supabase = getSupabase();

    // If no foodId provided, try to look one up
    let resolvedFoodId = foodId;
    if (!resolvedFoodId) {
      const match = await this.lookupFoodByName(name);
      if (match) resolvedFoodId = match.id;
    }

    const { data, error } = await supabase
      .from('pantry')
      .insert({
        user_id: userId,
        household_id: householdId || null,
        name,
        food_id: resolvedFoodId || null,
        status: 'active',
        probability_score: 1.0,
        metadata_json: {},
      })
      .select()
      .single();

    if (error) throw normalizeError(error);
    return data;
  },
};

