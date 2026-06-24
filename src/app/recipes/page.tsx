'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronDown, ChefHat, Link2, Loader2, Minus, Plus, RefreshCw, Trash2, Check, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BottomNav } from '@/components/layout/BottomNav';
import { recipeService } from '@/lib/services/recipe.service';
import { scaleRecipe, totalMacros, type Recipe } from '@/lib/utils/recipes';

function RecipeCard({ recipe, onDelete, onSave }: { recipe: Recipe; onDelete?: () => void; onSave?: () => void }) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [servings, setServings] = useState(Math.max(1, recipe.servings || 1));
  const scaled = scaleRecipe(recipe, servings);
  const batch = totalMacros(scaled);
  const coveragePct = recipe.pantry_coverage != null ? Math.round(recipe.pantry_coverage * 100) : null;

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeOut' }}
      className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl shadow-sm overflow-hidden"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-5 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-[var(--text-primary)] leading-tight truncate">{recipe.title}</h3>
            <div className="flex items-center gap-3 mt-1.5">
              {coveragePct != null && (
                <span className="text-[11px] font-bold text-[var(--primary-text)] font-mono tabular-nums">{coveragePct}% from pantry</span>
              )}
              {recipe.source_type === 'imported' && (
                <span className="text-[11px] font-medium text-[var(--text-secondary)] inline-flex items-center gap-1"><Link2 size={10} aria-hidden="true" /> Imported</span>
              )}
            </div>
          </div>
          <ChevronDown size={16} className={`text-[var(--text-secondary)] transition-transform duration-300 shrink-0 mt-1 ${expanded ? 'rotate-180' : ''}`} />
        </div>

        {coveragePct != null && (
          <div className="mt-3 h-1 bg-[var(--bg-app)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${coveragePct}%` }} />
          </div>
        )}

        <div className="flex gap-4 mt-3 font-mono tabular-nums">
          {([['kcal', scaled.macros_per_serving?.calories], ['P', scaled.macros_per_serving?.protein], ['C', scaled.macros_per_serving?.carbs], ['F', scaled.macros_per_serving?.fat]] as const).map(([label, val]) => (
            <div key={label} className="text-[10px] font-bold text-[var(--text-primary)] flex flex-col">
              <span className="text-[var(--text-secondary)]">{label}</span>
              <span>{Math.round(val || 0)}{label === 'kcal' ? '' : 'g'}</span>
            </div>
          ))}
          <span className="ml-auto text-[10px] font-medium text-[var(--text-secondary)] self-end">per serving</span>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
            className="border-t border-[var(--border)]"
          >
            <div className="p-5 bg-[var(--bg-app)]/50 space-y-5">
              {/* Portion scaling */}
              <div>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Servings</span>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                    disabled={servings <= 1}
                    aria-label="Fewer servings"
                    className="w-11 h-11 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Minus size={16} />
                  </button>
                  <div className="text-center">
                    <span className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">{servings}×</span>
                    <span className="block text-[10px] text-[var(--text-secondary)] font-mono tabular-nums">{batch.calories} kcal · {batch.protein}g P total</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setServings((s) => Math.min(12, s + 1))}
                    disabled={servings >= 12}
                    aria-label="More servings"
                    className="w-11 h-11 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Ingredients with pantry status + smart swaps */}
              <div>
                <h4 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-2">Ingredients</h4>
                <div className="space-y-2">
                  {scaled.ingredients.map((ing, i) => (
                    <div key={i} className="px-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-[var(--text-primary)] font-medium flex items-center gap-2 min-w-0">
                          {ing.from_pantry ? (
                            <Check size={12} className="text-[var(--success-text)] shrink-0" aria-label="In your pantry" />
                          ) : (
                            <ShoppingCart size={12} className="text-[var(--text-secondary)] shrink-0" aria-label="Not in pantry" />
                          )}
                          <span className="truncate">{ing.name}</span>
                        </span>
                        {ing.grams != null && (
                          <span className="text-sm text-[var(--text-secondary)] font-mono tabular-nums shrink-0">{ing.grams} g</span>
                        )}
                      </div>
                      {!ing.from_pantry && ing.swap?.use && (
                        <p className="text-[11px] font-medium text-[var(--primary-text)] mt-0.5 ml-6">
                          Smart swap: use {ing.swap.use} instead
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              {recipe.instructions.length > 0 && (
                <div>
                  <h4 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-2">Steps</h4>
                  <ol className="space-y-2">
                    {recipe.instructions.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm text-[var(--text-primary)] font-medium leading-relaxed">
                        <span className="font-mono text-[11px] font-bold text-[var(--primary-text)] tabular-nums shrink-0 mt-0.5">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {(onSave || onDelete) && (
                <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
                  {onSave && (
                    <button
                      type="button"
                      onClick={onSave}
                      className="flex-1 h-11 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] active:scale-95 transition-transform"
                    >
                      Save recipe
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={onDelete}
                      className="h-11 px-4 rounded-xl text-[11px] font-bold text-[var(--error-text)] active:scale-95 transition-transform inline-flex items-center gap-2"
                    >
                      <Trash2 size={12} aria-hidden="true" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function RecipesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<Recipe[]>([]);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const { data: saved = [], isError: savedError, refetch: refetchSaved } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => recipeService.listRecipes(),
    staleTime: 60 * 1000,
  });

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const result = await recipeService.generateRecipes();
      setGenerated(result.recipes || []);
      if ((result.recipes || []).length === 0) toast.error('No recipes came back — try again.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Recipe generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleImport = async () => {
    const url = importUrl.trim();
    if (!url || importing) return;
    setImporting(true);
    try {
      const recipe = await recipeService.importRecipe(url);
      toast.success(`Imported "${recipe.title}"`);
      setImportUrl('');
      await queryClient.invalidateQueries({ queryKey: ['recipes'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveGenerated = async (recipe: Recipe) => {
    try {
      await recipeService.saveRecipe(recipe);
      toast.success('Recipe saved');
      await queryClient.invalidateQueries({ queryKey: ['recipes'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    try {
      await recipeService.deleteRecipe(id);
      await queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast('Recipe deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete.');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 font-sans">
      <header className="flex items-center gap-4 pt-safe mb-8">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-1">Recipes</h1>
          <p className="text-[13px] font-semibold text-[var(--text-secondary)]">Cook from what you already have</p>
        </div>
      </header>

      <div className="space-y-6 max-w-xl mx-auto">
        {/* Generate from pantry */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[28px] p-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary-text)]"><ChefHat size={16} /></div>
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">From your pantry</h2>
              <p className="text-[11px] font-medium text-[var(--text-secondary)]">Recipes built around what&apos;s on your shelves.</p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 w-full h-12 bg-[var(--primary)] text-[var(--primary-fg)] rounded-xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate recipes'}
          </button>
        </div>

        {/* Import from a link */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[28px] p-6">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Import from a link</h2>
          <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-1">Recipe pages, YouTube, TikTok — the recipe needs to be in the page or caption.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleImport(); }}
              placeholder="https://..."
              aria-label="Recipe link"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 h-12 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            />
            <button
              onClick={handleImport}
              disabled={importing || !importUrl.trim()}
              className="h-12 px-5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] active:scale-95 transition-transform disabled:opacity-50 shrink-0"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import'}
            </button>
          </div>
        </div>

        {/* Generated results */}
        {generating && (
          <div role="status" aria-label="Generating recipes" className="space-y-4">
            <div className="h-32 rounded-3xl shimmer border border-[var(--border)]" />
            <div className="h-32 rounded-3xl shimmer border border-[var(--border)]" />
            <span className="sr-only">Generating recipes from your pantry</span>
          </div>
        )}
        {!generating && generated.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] px-2">Fresh from the engine</h2>
            <AnimatePresence mode="popLayout">
              {generated.map((r, i) => (
                <RecipeCard key={`${r.title}-${i}`} recipe={r} onSave={() => handleSaveGenerated(r)} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Saved recipes */}
        {savedError ? (
          <div role="alert" className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-8 text-center">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Couldn&apos;t load your recipes</h2>
            <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">Check your connection and try again.</p>
            <button
              onClick={() => refetchSaved()}
              className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] active:scale-95 transition-transform"
            >
              <RefreshCw size={12} /> Try again
            </button>
          </div>
        ) : saved.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] px-2">Saved</h2>
            <AnimatePresence mode="popLayout">
              {saved.map((r) => (
                <RecipeCard key={r.id} recipe={r} onDelete={() => handleDelete(r.id)} />
              ))}
            </AnimatePresence>
          </div>
        ) : null}
      </div>

      <BottomNav />
    </div>
  );
}
