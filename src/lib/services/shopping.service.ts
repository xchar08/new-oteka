import { createClient } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/utils/errors';
import { pantryService } from './pantry.service';

const getSupabase = () => createClient();

export const shoppingService = {
  async getList(userId: string, householdId: string | null) {
    const supabase = getSupabase();
    let query = supabase.from('shopping_list').select('*');
    if (householdId) {
      query = query.eq('household_id', householdId);
    } else {
      query = query.eq('added_by', userId).is('household_id', null);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw normalizeError(error);
    return data;
  },

  /**
   * Builds a consolidated view of the household shopping list, 
   * merging manual entries with smart pantry suggestions.
   */
  async getConsolidatedList(userId: string, householdId: string | null) {
    const supabase = getSupabase();
    
    // 1. Fetch Shared List
    const sharedList = await this.getList(userId, householdId);
    
    // 2. Fetch User Names for the list
    const userIds = Array.from(new Set(sharedList.map((i: any) => i.added_by).filter(Boolean)));
    const { data: memberNames } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', userIds);
    
    const nameMap = Object.fromEntries(memberNames?.map(m => [m.id, m.display_name]) || []);

    const combined: any[] = sharedList.map((item: any) => ({
      id: `list-${item.id}`,
      type: 'db_list',
      db_id: item.id,
      name: item.name,
      category: 'Shared List',
      reason: item.category || 'Manual Add',
      added_by_name: nameMap[item.added_by] || 'Member'
    }));

    // 3. Fetch Pantry Suggestions
    const pantry = await pantryService.getPantry(userId);
    const lowStock = pantry.filter((p: any) => p.probability_score < 0.3);
    
    lowStock.forEach((p: any) => {
      const name = p.foods?.name || 'Unknown Item';
      if (combined.some(i => i.name.toLowerCase() === name.toLowerCase())) return;
      
      combined.push({
        id: `pantry-${p.id}`,
        type: 'suggestion',
        db_id: p.id,
        name: name,
        category: 'Pantry Restock',
        reason: `Low Stock (${(p.probability_score * 100).toFixed(0)}%)`
      });
    });

    return combined;
  },

  async upsertItem(item: any) {
    const supabase = getSupabase();
    const { id, temp_id, ...data } = item;
    
    if (id) {
      const { data: res, error } = await supabase
        .from('shopping_list')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw normalizeError(error);
      return res;
    } else {
      const { data: res, error } = await supabase
        .from('shopping_list')
        .insert(data)
        .select()
        .single();
      if (error) throw normalizeError(error);
      return res;
    }
  },

  async deleteItem(id: number) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .eq('id', id);

    if (error) throw normalizeError(error);
    return true;
  }
};
