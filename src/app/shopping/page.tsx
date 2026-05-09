'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { shoppingService } from '@/lib/services/shopping.service';
import { pantryService } from '@/lib/services/pantry.service';
import { CheckCircle, Loader2, Plus, ShoppingCart, ChevronLeft, Trash2, ArrowRight, Sparkles, Zap, Clock, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { useDashboardData } from '@/lib/hooks/useDashboardData';

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
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPhase, setAiPhase] = useState('');
  const router = useRouter();

  // 1. Fetch User Data from Dashboard (Consolidated Source)
  const { user: userProfile, loading: isUserLoading } = useDashboardData();
  const householdId = userProfile?.household_id;

  // 2. Fetch Shopping List via Consolidated Service
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shopping-list', userProfile?.id, householdId],
    queryFn: async () => {
      if (!userProfile?.id || !householdId) return [];
      return shoppingService.getConsolidatedList(userProfile.id, householdId);
    },
    enabled: !!userProfile && !!householdId
  });

  const runAiOptimization = async () => {
    if (aiLoading || !userProfile?.id || !householdId) return;
    setAiLoading(true);
    setAiSuggestions([]);
    setAiAnalysis('');
    
    try {
      setAiPhase('Calibrating metabolic targets...');
      
      const supabase = createClient();
      
      setAiPhase('Querying genetic planning optimization...');
      const { data, error } = await supabase.functions.invoke('shopping-generator');
      
      setAiPhase('Formatting nutrient supply requirements...');

      if (error || data?.failure) {
        throw new Error(error?.message || data?.error || 'Logistics engine failed.');
      }

      setAiSuggestions(data.suggestions || []);
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
    if (!userProfile?.id || !householdId) return;
    
    try {
      await shoppingService.upsertItem({
        household_id: householdId,
        name: suggestion.name,
        added_by: userProfile.id,
      });
      
      // Filter out of local suggestions array with a nice exit animation
      setAiSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      toast.success(`Added ${suggestion.name} to shared list!`);
    } catch (err) {
      toast.error("Failed to add suggestion to database.");
    }
  };

  // 3. Mutations
  const actionMutation = useMutation({
    mutationFn: async (item: ShoppingItem) => {
      if (!userProfile) throw new Error('Not logged in');

      if (item.type === 'db_list' && item.db_id) {
          await shoppingService.deleteItem(item.db_id);
          // Add to pantry (Quick insert is fine here as it's a direct transition)
          const supabase = createClient();
          await supabase.from('pantry').insert({
            user_id: userProfile.id,
            household_id: householdId,
            name: item.name,
            status: 'active'
          });
          return { name: item.name, action: 'purchased' };
      } else if (item.category === 'Pantry Restock' && item.db_id) {
          await pantryService.verifyItem(item.db_id, 'active');
          return { name: item.name, action: 'restocked' };
      } else {
          await shoppingService.upsertItem({
              household_id: householdId,
              name: item.name,
              added_by: userProfile.id,
          });
          return { name: item.name, action: 'added' };
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['pantry-items'] });
      toast.success(`${data.name} ${data.action}`);
    }
  });

  const handleManualAdd = async () => {
    if (!manualInput.trim() || !userProfile?.id || !householdId) return;
    
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
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 flex flex-col gap-6 animate-in fade-in duration-500">
      
      <header className="flex items-center gap-4 pt-safe">
        <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <div>
           <h1 className="text-3xl font-light tracking-tight mb-1">Shopping</h1>
           <p className="text-[var(--text-secondary)] text-sm">Managed household supply.</p>
        </div>
      </header>

      <div className="relative z-10">
          <input 
            type="text" 
            placeholder="Add to shared list..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleManualAdd();
            }}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl h-14 pl-5 pr-14 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--primary)] transition-all shadow-sm"
          />
          <button 
            onClick={handleManualAdd}
            disabled={!manualInput.trim()}
            className="absolute right-3 top-3 h-8 w-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center disabled:opacity-30"
          >
              <Plus className="h-5 w-5" />
          </button>
      </div>

      {/* AI Smart Logistics Control */}
      <div className="relative z-10">
        <AnimatePresence mode="popLayout">
          {/* State 1: Run button card */}
          {!aiLoading && aiSuggestions.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-r from-[var(--primary)]/10 to-transparent border border-[var(--border)] rounded-[2rem] p-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4"
            >
              <div className="flex items-center gap-4 text-left mr-auto">
                <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
                  <Sparkles size={22} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)]">AI Logistics Supply Engine</h4>
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold mt-1 leading-normal max-w-xs">
                    Analyze user deficiencies, pantry decay coefficients, and preference feedback in real-time.
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={runAiOptimization}
                className="w-full sm:w-auto h-12 px-6 bg-[var(--primary)] text-white font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[var(--primary)]/10 shrink-0"
              >
                <Sparkles size={14} fill="currentColor" />
                Run AI Restock
              </motion.button>
            </motion.div>
          )}

          {/* State 2: Progress loader spinner */}
          {aiLoading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-8 text-center shadow-md flex flex-col items-center justify-center gap-4 min-h-[160px] relative overflow-hidden"
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
                <p className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-1.5 opacity-40">Oteka genetic modeling engine active</p>
              </div>
            </motion.div>
          )}

          {/* State 3: Display AI recommendations panel */}
          {!aiLoading && aiSuggestions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[var(--bg-surface)] border border-[var(--primary)]/20 rounded-[2.5rem] p-6 shadow-xl shadow-[var(--primary)]/5 space-y-5"
            >
              <div className="flex justify-between items-start border-b border-[var(--border)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                    <Sparkles size={20} fill="currentColor" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)]">AI Smart Logistics suggestions</h4>
                    <p className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-0.5">Biochemical Nutrient Gap Fill</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setAiSuggestions([]);
                    setAiAnalysis('');
                  }}
                  className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors py-1.5 px-3 bg-[var(--bg-app)] border border-[var(--border)] rounded-lg"
                >
                  Clear
                </button>
              </div>

              <div className="bg-[var(--bg-app)] border border-[var(--border)]/60 rounded-2xl p-4">
                <p className="text-xs leading-relaxed text-[var(--text-primary)] italic opacity-90 font-medium">
                  "{aiAnalysis}"
                </p>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {aiSuggestions.map((suggestion, index) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={`${suggestion.name}-${index}`}
                    className="flex items-center justify-between p-4 rounded-2xl border bg-[var(--bg-surface-2)] border-[var(--border)] shadow-sm group"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[var(--text-primary)] text-base truncate capitalize">{suggestion.name}</span>
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
                        <div className="w-1 h-1 bg-[var(--border)] rounded-full shrink-0" />
                        <div className="text-[9px] text-[var(--text-secondary)] font-semibold truncate">{suggestion.reason}</div>
                      </div>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.1, backgroundColor: 'var(--primary)', color: '#fff' }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleAcceptSuggestion(suggestion)}
                      className="w-10 h-10 rounded-xl bg-[var(--bg-app)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] transition-colors shadow-sm shrink-0"
                    >
                      <Plus size={20} strokeWidth={2.5} />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
       
      <div className="space-y-8 relative z-10">
        {items.length === 0 ? (
          <div className="text-center py-20 bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-[32px]">
            <CheckCircle className="h-10 w-10 mx-auto mb-4 text-[var(--primary)] opacity-20" />
            <p className="text-[var(--text-secondary)] font-medium">Everything is stocked up.</p>
          </div>
        ) : (
            <>
                {groupedItems.shared.length > 0 && (
                    <section>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4 ml-1">Shared Household List</h3>
                        <div className="space-y-3">
                            {groupedItems.shared.map(item => (
                                <ShoppingItemRow key={item.id} item={item} onAction={() => actionMutation.mutate(item)} isProcessing={actionMutation.isPending && (actionMutation.variables as any)?.id === item.id} />
                            ))}
                        </div>
                    </section>
                )}

                {groupedItems.pantry.length > 0 && (
                    <section>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--error)] mb-4 ml-1">Pantry Restock Required</h3>
                        <div className="space-y-3">
                            {groupedItems.pantry.map(item => (
                                <ShoppingItemRow key={item.id} item={item} onAction={() => actionMutation.mutate(item)} isProcessing={actionMutation.isPending && (actionMutation.variables as any)?.id === item.id} />
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

function ShoppingItemRow({ item, onAction, isProcessing }: { item: ShoppingItem; onAction: () => void; isProcessing: boolean }) {
    return (
        <motion.div 
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center justify-between p-4 rounded-2xl border bg-[var(--bg-surface)] border-[var(--border)] shadow-sm group`}
        >
            <div className="flex-1 min-w-0 mr-4">
                <div className="font-bold text-[var(--text-primary)] text-base truncate capitalize">{item.name}</div>
                <div className="flex items-center gap-2 mt-1">
                   <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">{item.reason}</div>
                   {item.added_by_name && (
                       <>
                        <div className="w-1 h-1 bg-[var(--border)] rounded-full" />
                        <div className="text-[9px] text-[var(--primary)] uppercase tracking-wider font-black">By {item.added_by_name}</div>
                       </>
                   )}
                </div>
            </div>
            <button 
                onClick={onAction}
                disabled={isProcessing}
                className="w-12 h-12 rounded-xl bg-[var(--bg-app)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--primary)] hover:text-white transition-all active:scale-90"
            >
                {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus size={22} />}
            </button>
        </motion.div>
    );
}
