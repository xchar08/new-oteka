import { createClient } from '@/lib/supabase/client';

const getSupabase = () => createClient();

export const visionService = {
  /**
   * Uploads a raw image blob to the food_scans storage bucket.
   * This is the entry point for the "Storage-First" asynchronous pipeline.
   */
  async uploadScan(userId: string, blob: Blob) {
    const supabase = getSupabase();
    const fileName = `${userId}/${Date.now()}-${crypto.randomUUID()}.jpg`;
    
    const { data, error } = await supabase.storage
      .from('food_scans')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;
    return { path: data.path, fileName };
  },

  /**
   * Fetches the latest logs for the user.
   */
  async getDailyLogs(userId: string) {
    const supabase = getSupabase();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('user_id', userId)
      .gte('captured_at', startOfDay.toISOString())
      .order('captured_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};
