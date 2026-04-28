import { createClient } from '@/lib/supabase/client';

const getSupabase = () => createClient();

export const shoppingService = {
  async getList(householdId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
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
      if (error) throw error;
      return res;
    } else {
      const { data: res, error } = await supabase
        .from('shopping_list')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return res;
    }
  },

  async deleteItem(id: number) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
