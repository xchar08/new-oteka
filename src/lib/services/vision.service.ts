import { createClient } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/utils/errors';
import { userService } from './user.service';

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

    if (error) throw normalizeError(error);
    return { path: data.path, fileName };
  },

  /**
   * Helper to resolve raw image paths into secure signed URLs.
   */
  async resolveLogImages(logs: any[]) {
      if (!logs || logs.length === 0) return logs;
      const supabase = getSupabase();
      
      // 1. Collect all paths from metabolic_tags_json
      const paths = logs
        .map(log => log.metabolic_tags_json?.image_path)
        .filter(Boolean);

      if (paths.length === 0) return logs;

      // 2. Generate signed URLs in parallel with transform options for CDN-side optimization
      const signedResults = await Promise.all(
        paths.map(async (path) => {
          const { data, error } = await supabase.storage
            .from('food_scans')
            .createSignedUrl(path, 60 * 60 * 24, {
              transform: {
                width: 300,
                height: 300,
                resize: 'cover',
                format: 'origin'
              }
            });
          if (error) {
            console.error(`[Vision Service] Failed to sign path "${path}":`, error.message);
          }
          return { path, signedUrl: data?.signedUrl || null };
        })
      );

      // 3. Map signed URLs back to log objects as top-level image_url
      return logs.map(log => {
          const path = log.metabolic_tags_json?.image_path;
          if (!path) return log;
          
          const signedMatch = signedResults.find(s => s.path === path);
          return {
              ...log,
              image_url: signedMatch?.signedUrl || null
          };
      });
  },

  /**
   * Fetches the latest logs for the user with resolved image URLs.
   */
  async getDailyLogs(userId: string) {
    const supabase = getSupabase();
    // Use strictly the local date string (YYYY-MM-DD)
    const localDate = new Date().toLocaleDateString('en-CA');

    const { data, error } = await supabase
      .from('logs')
      .select('id, user_id, grams, metabolic_tags_json, captured_at, local_date')
      .eq('user_id', userId)
      .eq('local_date', localDate)
      .order('captured_at', { ascending: false });

    if (error) throw normalizeError(error);
    
    // Pass through image resolver
    return this.resolveLogImages(data || []);
  },

  /**
   * Logs a meal/food item to the metabolic history.
   */
  async logMeal(userId: string, data: {
    grams: number;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    ingredients?: string[];
  }) {
    const supabase = getSupabase();
    const localDate = new Date().toLocaleDateString('en-CA');
    const { error } = await supabase.from('logs').insert({
      user_id: userId,
      grams: data.grams,
      local_date: localDate,
      metabolic_tags_json: {
        food_name: data.name,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        ingredients: data.ingredients || []
      }
    });

    if (error) throw normalizeError(error);
    return true;
  },

  /**
   * Applies a user correction to a logged meal (name, portion, nutrients).
   * The patch replaces grams and metabolic_tags_json wholesale; callers are
   * responsible for preserving fields they don't intend to change.
   */
  async updateLog(logId: string, patch: { grams: number; metabolic_tags_json: Record<string, unknown> }) {
    const supabase = getSupabase();
    const { error } = await supabase.from('logs').update({
      grams: patch.grams,
      metabolic_tags_json: patch.metabolic_tags_json,
    }).eq('id', logId);

    if (error) throw normalizeError(error);
    return true;
  },

  /**
   * Permanently removes a logged meal. The meal's calibration feedback goes
   * with it (the optimizer drops that sample). Storage image cleanup is a
   * separate concern (deferred).
   */
  async deleteLog(logId: string) {
    const supabase = getSupabase();
    const { error } = await supabase.from('logs').delete().eq('id', logId);
    if (error) throw normalizeError(error);
    return true;
  },

  /**
   * Re-inserts a deleted log row verbatim — the undo path for deleteLog.
   */
  async restoreLog(log: { id: string; user_id: string; grams: number | null; metabolic_tags_json: unknown; captured_at: string; local_date: string | null }) {
    const supabase = getSupabase();
    const { error } = await supabase.from('logs').insert({
      id: log.id,
      user_id: log.user_id,
      grams: log.grams,
      metabolic_tags_json: log.metabolic_tags_json,
      captured_at: log.captured_at,
      local_date: log.local_date,
    });
    if (error) throw normalizeError(error);
    return true;
  },

  /**
   * Updates a specific log entry with user feedback (Taste, Satiety, Digestion).
   * This data is used by the NSGA-II Optimization Algorithm.
   */
  async updateLogFeedback(logId: string, currentTags: any, feedback: { taste: number, satiety: number, digestion: number }) {
    const supabase = getSupabase();
    
    // 1. Update log feedback
    const { error } = await supabase.from('logs').update({
      metabolic_tags_json: {
        ...currentTags,
        feedback
      }
    }).eq('id', logId);

    if (error) throw normalizeError(error);

    // 2. Refine taste profile from feedback.
    // Vision logs store the food under `item`; manual logs use `food_name`.
    const foodName = currentTags?.food_name || currentTags?.item;
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id && foodName) {
      try {
        await userService.refineTasteFromFeedback(user.id, foodName, feedback.taste);
      } catch (e) {
        console.warn("[Taste Engine] Failed to refine taste profile:", e);
      }
    }

    return true;
  }
};
