import { createClient } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/utils/errors';
import type { Recipe } from '@/lib/utils/recipes';

const getSupabase = () => createClient();

export const recipeService = {
  /**
   * Pantry-first generation: three recipes ranked by pantry coverage, with
   * verified from_pantry flags and Smart Swap suggestions for missing
   * ingredients. Always returns base servings = 1; scale client-side.
   */
  async generateRecipes(options?: { mealType?: string; save?: boolean }): Promise<{ recipes: Recipe[]; pantry_size: number }> {
    const supabase = getSupabase();
    const { data, error } = await supabase.functions.invoke('recipe-engine', {
      body: { meal_type: options?.mealType, save: options?.save === true },
    });
    if (error) throw normalizeError(error);
    if (data?.error) throw new Error(data.error);
    return data;
  },

  /** Imports a structured recipe from a shared URL / video post. */
  async importRecipe(url: string): Promise<Recipe> {
    const supabase = getSupabase();
    const { data, error } = await supabase.functions.invoke('recipe-import', {
      body: { url },
    });
    if (error) throw normalizeError(error);
    if (data?.error) throw new Error(data.error);
    return data.recipe;
  },

  async listRecipes(): Promise<Recipe[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw normalizeError(error);
    return (data || []) as Recipe[];
  },

  async saveRecipe(recipe: Recipe): Promise<void> {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase.from('recipes').insert({
      user_id: user.id,
      title: recipe.title,
      source_type: recipe.source_type || 'generated',
      source_url: recipe.source_url ?? null,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      macros_per_serving: recipe.macros_per_serving,
      pantry_coverage: recipe.pantry_coverage ?? null,
    });
    if (error) throw normalizeError(error);
  },

  async deleteRecipe(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) throw normalizeError(error);
  },
};
