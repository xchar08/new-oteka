import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export const pantryService = {
  async getPantry(userId: string) {
    const { data, error } = await supabase
      .from('pantry')
      .select('*, foods(name, category_decay_rate)')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw error;
    return data;
  },

  async verifyItem(pantryId: number, status: 'active' | 'consumed') {
    const { data, error } = await supabase
      .from('pantry')
      .update({
        status,
        last_verified_at: new Date().toISOString(),
      })
      .eq('id', pantryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
