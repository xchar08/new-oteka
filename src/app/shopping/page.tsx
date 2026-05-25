'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { shoppingService } from '@/lib/services/shopping.service';
import { pantryService } from '@/lib/services/pantry.service';
import { CheckCircle, Loader2, Plus, ShoppingCart, ChevronLeft, Trash2, ArrowRight, Sparkles, Zap, Clock, Activity, BookOpen, Microscope } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { MetabolicRecipeCard, MetabolicRecipe } from '@/components/shopping/MetabolicRecipeCard';

type ShoppingItem = {
  id: string;
  type: 'db_list' | 'suggestion';
  db_id?: number;
  name: string;
  category: 'Shared List' | 'Pantry Restock' | 'Meal Plan' | 'Smart Suggestion';
  reason: string;
  added_by_name?: string;
  priority?: string;
};

export default function ShoppingPage() {
  const queryClient = useQueryClient();
  const [manualInput, setManualInput] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [aiRecipes, setAiRecipes] = useState<MetabolicRecipe[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPhase, setAiPhase] = useState('');
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const router = useRouter();

  const { user: userProfile, loading: isUserLoading } = useDashboardData();
  const isPro = userProfile?.plan === 'pro';
  const householdId = userProfile?.household_id;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shopping-list', userProfile?.id, householdId],
    queryFn: async () => {
      if (!userProfile?.id) return [];
      return shoppingService.getConsolidatedList(userProfile.id, householdId || null);
    },
    enabled: !!userProfile
  });

  const runAiOptimization = async () => {
    if (aiLoading || !userProfile?.id) return;
    setAiLoading(true);
    setAiSuggestions([]);
    setAiRecipes([]);
    setAiAnalysis('');
    
    try {
      setAiPhase('Calibrating metabolic targets...');
      const supabase = createClient();
      
      setAiPhase('Querying genetic planning optimization...');
      const { data, error } = await supabase.functions.invoke('shopping-generator');
      
      setAiPhase('Synthesizing Bio-Aligned Recipe Pool...');

      if (error || data?.failure) {
        throw new Error(error?.message || data?.error || 'Logistics engine failed.');
      }

      setAiSuggestions(data.suggestions || []);
      setAiRecipes(data.recipes || []);
      setAiAnalysis(data.analysis || 'Optimal household metabolic supply.');
      toast.success("AI logistics optimization compiled successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(`Logistics Failure: ${err.message || 'Check models and variables.'}`);
    } finally {
      setAiLoading(false);
      setAiPhase('');
    }
  };

  const handleAcceptSuggestion = async (suggestion: any) => {
    if (!userProfile?.id) return;
    
    // OPTIMISTIC UPDATE: Local UI feedback
    const originalSuggestions = [...aiSuggestions];
    setAiSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
    
    try {
      await shoppingService.upsertItem({
        household_id: householdId || null,
        name: suggestion.name,
        added_by: userProfile.id,
      });
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      toast.success(`Added ${suggestion.name} to shared list!`);
    } catch (err) {
      setAiSuggestions(originalSuggestions);
      toast.error("Failed to add suggestion to database.");
    }
  };

  const actionMutation = useMutation({
    mutationFn: async (item: ShoppingItem) => {
      if (!userProfile) throw new Error('Not logged in');
      if (item.type === 'db_list' && item.db_id) {
          await shoppingService.deleteItem(item.db_id);
          
          // Look up food_id from the foods table for proper optimizer linkage
          const supabaseClient = createClient();
          const { data: foodMatch } = await supabaseClient
            .from('foods')
            .select('id')
            .ilike('name', item.name.trim())
            .limit(1);
          
          let foodId = foodMatch?.[0]?.id || null;
          if (!foodId) {
            const { data: fuzzyMatch } = await supabaseClient
              .from('foods')
              .select('id')
              .ilike('name', `%${item.name.trim()}%`)
              .limit(1);
            foodId = fuzzyMatch?.[0]?.id || null;
          }
          
          const supabase = createClient();
          await supabase.from('pantry').insert({
            user_id: userProfile.id,
            household_id: householdId || null,
            name: item.name,
            food_id: foodId,
            status: 'active'
          });
          return { name: item.name, action: 'purchased' };
      } else if (item.category === 'Pantry Restock' && item.db_id) {
          await pantryService.verifyItem(item.db_id, 'active');
          return { name: item.name, action: 'restocked' };
      } else {
          await shoppingService.upsertItem({
              household_id: householdId || null,
              name: item.name,
              added_by: userProfile.id,
          });
          return { name: item.name, action: 'added' };
      }
    },
    onMutate: async (newItem) => {
        // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        await queryClient.cancelQueries({ queryKey: ['shopping-list'] });

        // Snapshot the previous value
        const previousItems = queryClient.getQueryData(['shopping-list', userProfile?.id, householdId]);

        // Optimistically update to the new value
        if (newItem.type === 'suggestion') {
            queryClient.setQueryData(['shopping-list', userProfile?.id, householdId], (old: any) => [
                ...(old || []),
                {
                    id: newItem.id,
                    name: newItem.name,
                    category: newItem.category,
                    reason: newItem.reason,
                    type: 'db_list'
                }
            ]);
        }

        return { previousItems };
    },
    onError: (err, newItem, context) => {
        queryClient.setQueryData(['shopping-list', userProfile?.id, householdId], context?.previousItems);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['pantry-items'] });
      toast.success(`${data.name} ${data.action}`);
    }
  });

  const handleManualAdd = async () => {
    if (!manualInput.trim() || !userProfile?.id) return;
    actionMutation.mutate({
      id: `manual-${Date.now()}`,
      type: 'suggestion',
      name: manualInput.trim(),
      category: 'Shared List',
      reason: 'Manual Add'
    });
    setManualInput('');
  };

  if (isLoading || isUserLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  const groupedItems = {
    shared: items.filter(i => i.category === 'Shared List'),
    pantry: items.filter(i => i.category === 'Pantry Restock'),
  };

  return (
    <div className="min-h-screen p-6 pb-32 flex flex-col gap-6 animate-in fade-in duration-500 transition-colors bg-[var(--bg-app)] text-[var(--text-primary)]">
      
      <header className="flex items-center gap-4 pt-safe">
        <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)]"
        >
            <ChevronLeft size={24} />
        </button>
        <div>
           <h1 className="text-3xl font-black tracking-tight mb-1">{isPro ? 'Neural Logistics' : 'Logistics'}</h1>
           <p className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)]">
               {isPro ? 'Elite Supply Protocol' : 'Managed household supply'}
           </p>
        </div>
      </header>

      <div className="relative z-10">
          <input 
            type="text" 
            placeholder={isPro ? "Integrate manual supply..." : "Add to supply chain..."}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleManualAdd();
            }}
            className="w-full border rounded-2xl h-14 pl-5 pr-14 outline-none transition-all shadow-sm bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--primary)]"
          />
          <button 
            onClick={handleManualAdd}
            disabled={!manualInput.trim()}
            className="absolute right-3 top-3 h-8 w-8 rounded-lg flex items-center justify-center disabled:opacity-30 bg-[var(--primary)]/10 text-[var(--primary)]"
          >
              <Plus className="h-5 w-5" strokeWidth={3} />
          </button>
      </div>

      {/* AI Smart Logistics Control */}
      <div className="relative z-10">
        <AnimatePresence mode="popLayout">
          {!aiLoading && aiSuggestions.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border rounded-[2rem] p-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 bg-gradient-to-r from-[var(--primary)]/10 to-transparent border-[var(--border)]"
            >
              <div className="flex items-center gap-4 text-left mr-auto">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-[var(--primary)]/10 text-[var(--primary)]">
                  <Sparkles size={22} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider">Neural Supply Engine</h4>
                  <p className="text-[10px] font-bold mt-1 leading-normal max-w-xs text-[var(--text-secondary)]">
                    Synthesize shopping lists and recipe pools aligned with your medical conditions and deficiency gaps.
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={runAiOptimization}
                className="w-full sm:w-auto h-12 px-6 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 shadow-md shrink-0 bg-[var(--primary)] text-[var(--primary-fg)] shadow-[var(--primary)]/10"
              >
                Run AI Optimization
              </motion.button>
            </motion.div>
          )}

          {aiLoading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border rounded-[2rem] p-8 text-center shadow-md flex flex-col items-center justify-center gap-4 min-h-[160px] relative overflow-hidden bg-[var(--bg-surface)] border-[var(--border)]"
            >
              <div className="absolute top-0 left-0 h-1 bg-[var(--primary)] w-full">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4, ease: "easeInOut" }}
                  className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]"
                />
              </div>
              <Loader2 className="animate-spin text-[var(--primary)] h-8 w-8" />
              <div>
                <h4 className="font-black text-xs uppercase tracking-[0.2em] text-[var(--primary)] animate-pulse">{aiPhase}</h4>
                <p className="text-[9px] font-black uppercase tracking-widest mt-1.5 opacity-40">Oteka Bio-Synthesis engine active</p>
              </div>
            </motion.div>
          )}

          {!aiLoading && aiSuggestions.length > 0 && (
            <div className="space-y-6">
                {/* Shopping Suggestions */}
                <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="border rounded-[2.5rem] p-6 shadow-xl space-y-5 bg-[var(--bg-surface)] border-[var(--primary)]/20 shadow-[var(--primary)]/5"
                >
                    <div className="flex justify-between items-start border-b border-[var(--border)] pb-4">
                        <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary)]/10 text-[var(--primary)]">
                            <Sparkles size={20} fill="currentColor" />
                        </div>
                        <div>
                            <h4 className="font-black text-sm uppercase tracking-wider">AI Logistics Suggestions</h4>
                            <p className="text-[9px] font-black uppercase tracking-widest mt-0.5 opacity-40">Metabolic Gap Fill</p>
                        </div>
                        </div>
                        <button 
                        onClick={() => { setAiSuggestions([]); setAiAnalysis(''); setAiRecipes([]); }}
                        className="text-[9px] font-black uppercase tracking-widest transition-colors py-1.5 px-3 border rounded-lg bg-[var(--bg-app)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--error)]"
                        >
                        Clear
                        </button>
                    </div>

                    <div className="border rounded-2xl p-4 bg-[var(--bg-app)] border-[var(--border)]/60">
                        <p className="text-xs leading-relaxed italic opacity-90 font-medium font-serif">
                        "{aiAnalysis}"
                        </p>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
                        {aiSuggestions.map((suggestion, index) => (
                        <motion.div 
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={`${suggestion.name}-${index}`}
                            className="flex items-center justify-between p-4 rounded-2xl border shadow-sm group bg-[var(--bg-surface-2)] border-[var(--border)]"
                        >
                            <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-base truncate capitalize">{suggestion.name}</span>
                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                suggestion.priority === 'high' 
                                    ? 'bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20' 
                                    : 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20'
                                }`}>
                                {suggestion.priority || 'medium'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="text-[9px] text-[var(--primary)] uppercase tracking-wider font-bold shrink-0">{suggestion.category || 'Grocery'}</div>
                                <div className="w-1 h-1 rounded-full shrink-0 bg-[var(--border)]" />
                                <div className="text-[9px] opacity-60 font-semibold truncate">{suggestion.reason}</div>
                            </div>
                            </div>
                            <motion.button 
                            whileHover={{ scale: 1.1, backgroundColor: 'var(--primary)', color: '#000' }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleAcceptSuggestion(suggestion)}
                            className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all shadow-sm shrink-0 bg-[var(--bg-app)] border-[var(--border)] text-[var(--primary)]"
                            >
                            <Plus size={20} strokeWidth={2.5} />
                            </motion.button>
                        </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Recipe Pool Section */}
                {aiRecipes.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center gap-2 px-2">
                            <BookOpen size={16} className="text-[var(--primary)]" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Metabolic Recipe Pool</h3>
                        </div>
                        <div className="space-y-3">
                            {aiRecipes.map((recipe, i) => (
                                <MetabolicRecipeCard 
                                    key={i}
                                    recipe={recipe}
                                    isExpanded={expandedRecipe === recipe.title}
                                    onToggle={() => setExpandedRecipe(expandedRecipe === recipe.title ? null : recipe.title)}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>
          )}
        </AnimatePresence>
      </div>
       
      <div className="space-y-8 relative z-10">
        {items.length === 0 ? (
          <div className="text-center py-20 border border-dashed rounded-[32px] bg-[var(--bg-surface)] border-[var(--border)]">
            <CheckCircle className={`h-10 w-10 mx-auto mb-4 text-[var(--primary)] opacity-20`} />
            <p className="opacity-50 font-medium">Global metabolic supply optimal.</p>
          </div>
        ) : (
            <>
                {groupedItems.shared.length > 0 && (
                    <section>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 ml-1">Household Supply Chain</h3>
                        <div className="space-y-3">
                            {groupedItems.shared.map(item => (
                                <ShoppingItemRow key={item.id} item={item} isPro={isPro} onAction={() => actionMutation.mutate(item)} isProcessing={actionMutation.isPending && (actionMutation.variables as any)?.id === item.id} />
                            ))}
                        </div>
                    </section>
                )}

                {groupedItems.pantry.length > 0 && (
                    <section>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--error)] mb-4 ml-1 opacity-80">Critical Pantry Deficiencies</h3>
                        <div className="space-y-3">
                            {groupedItems.pantry.map(item => (
                                <ShoppingItemRow key={item.id} item={item} isPro={isPro} onAction={() => actionMutation.mutate(item)} isProcessing={actionMutation.isPending && (actionMutation.variables as any)?.id === item.id} />
                            ))}
                        </div>
                    </section>
                )}
            </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function ShoppingItemRow({ item, onAction, isProcessing, isPro }: { item: ShoppingItem; onAction: () => void; isProcessing: boolean; isPro: boolean }) {
    return (
        <motion.div 
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-4 rounded-2xl border shadow-sm group bg-[var(--bg-surface)] border-[var(--border)]"
        >
            <div className="flex-1 min-w-0 mr-4">
                <div className="font-bold text-base truncate capitalize">{item.name}</div>
                <div className="flex items-center gap-2 mt-1">
                   <div className="text-[9px] uppercase tracking-wider font-bold opacity-60">{item.reason}</div>
                   {item.added_by_name && (
                       <>
                        <div className="w-1 h-1 rounded-full bg-[var(--border)]" />
                        <div className="text-[9px] text-[var(--primary)] uppercase tracking-wider font-black">By {item.added_by_name}</div>
                       </>
                   )}
                </div>
            </div>
            <button 
                onClick={onAction}
                disabled={isProcessing}
                className="w-12 h-12 rounded-xl border flex items-center justify-center transition-all active:scale-90 bg-[var(--bg-app)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--primary)] hover:text-[var(--primary-fg)]"
            >
                {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus size={22} />}
            </button>
        </motion.div>
    );
}
