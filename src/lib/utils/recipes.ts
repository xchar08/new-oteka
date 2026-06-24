export interface RecipeIngredient {
  name: string;
  grams?: number;
  category?: string;
  from_pantry?: boolean;
  pantry_item?: string;
  swap?: { use: string; note: string } | null;
}

export interface RecipeMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  id?: string;
  title: string;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  macros_per_serving: RecipeMacros;
  pantry_coverage?: number | null;
  source_type?: 'generated' | 'imported';
  source_url?: string | null;
  created_at?: string;
}

/**
 * Portion scaling is pure math: ingredient grams scale linearly with the
 * serving count; per-serving macros are invariant. Ingredients without a
 * gram amount (imported quantity strings) pass through unchanged.
 */
export function scaleRecipe(recipe: Recipe, targetServings: number): Recipe {
  const base = Math.max(1, recipe.servings || 1);
  const target = Math.max(1, Math.round(targetServings));
  const factor = target / base;
  return {
    ...recipe,
    servings: target,
    ingredients: recipe.ingredients.map((i) =>
      i.grams != null ? { ...i, grams: Math.round(i.grams * factor) } : i
    ),
  };
}

/** Total macros for the whole scaled batch. */
export function totalMacros(recipe: Recipe): RecipeMacros {
  const s = Math.max(1, recipe.servings || 1);
  const m = recipe.macros_per_serving;
  return {
    calories: Math.round((m?.calories || 0) * s),
    protein: Math.round((m?.protein || 0) * s),
    carbs: Math.round((m?.carbs || 0) * s),
    fat: Math.round((m?.fat || 0) * s),
  };
}
