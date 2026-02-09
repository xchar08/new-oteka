'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, Loader2, Plus, Users, ShoppingCart, Sparkles, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

type ShoppingItem = {
  id: string; // "pantry-{id}" or "plan-{id}" or "list-{id}"
  type: 'db_list' | 'suggestion';
  db_id?: number; // Real DB ID for shopping_list or pantry items
  name: string;
  category: 'Shared List' | 'Pantry Restock' | 'Meal Plan' | 'Smart Suggestion';
  reason: string;
  priority?: string;
};

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  
  const supabase = createClient();

  // 1. Load Data
  useEffect(() => {
    async function generateList() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1a. Get Household
      const { data: userData } = await supabase
        .from('users')
        .select('household_id')
        .eq('id', user.id)
        .single();
      
      const hId = userData?.household_id;
      setHouseholdId(hId);

      const combinedItems: ShoppingItem[] = [];

      // 1b. Fetch Shared Shopping List
      if (hId) {
          const { data: sharedList } = await supabase
            .from('shopping_list')
            .select('*')
            .eq('household_id', hId)
            .eq('is_checked', false);
          
          if (sharedList) {
            sharedList.forEach((item: any) => {
                combinedItems.push({
                    id: `list-${item.id}`,
                    type: 'db_list',
                    db_id: item.id,
                    name: item.name,
                    category: 'Shared List',
                    reason: item.category || 'Manual Add'
                });
            });
          }
      }

      // 1c. Fetch Depleted Pantry Items (< 0.3)
      const { data: depletedPantry } = await supabase
        .from('pantry')
        .select('id, probability_score, foods ( name )')
        .eq('status', 'active')
        .lt('probability_score', 0.3)
        .order('probability_score', { ascending: true }); // most depleted first

      if (depletedPantry) {
        depletedPantry.forEach((p: any) => {
          // Dedup: Don't show if already in shared list
          if (combinedItems.some(i => i.name.toLowerCase() === p.foods?.name?.toLowerCase())) return;

          combinedItems.push({
            id: `pantry-${p.id}`,
            type: 'suggestion',
            db_id: p.id, // pantry id
            name: p.foods?.name || 'Unknown Item',
            category: 'Pantry Restock',
            reason: `Low Stock (${(p.probability_score * 100).toFixed(0)}%)`
          });
        });
      }

      // 1d. Fetch Latest Plan Items
      const { data: latestPlan } = await supabase
        .from('logs')
        .select('metabolic_tags_json')
        .contains('metabolic_tags_json', { type: 'plan' })
        .order('captured_at', { ascending: false })
        .limit(1)
        .single();

      if (latestPlan && latestPlan.metabolic_tags_json?.items) {
        const planItems: string[] = latestPlan.metabolic_tags_json.items;
        planItems.forEach((itemName, idx) => {
          // Dedup: Don't add if already in shared list OR suggestion list
          if (combinedItems.some(i => i.name.toLowerCase() === itemName.toLowerCase())) return;

          combinedItems.push({
            id: `plan-${itemName}-${idx}`,
            type: 'suggestion',
            name: itemName,
            category: 'Meal Plan',
            reason: 'For Meal Plan'
          });
        });
      }

      setItems(combinedItems);
      setLoading(false);
    }
    generateList();
  }, []);

  // 2. Handle Action (Check Off or Add to List)
  const handleAction = async (item: ShoppingItem) => {
    setProcessingId(item.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        const { mutateShopping, mutatePantryVerify, mutatePantryItem } = await import('@/lib/offline/mutations');

        if (item.type === 'db_list') {
            // ACTION: Mark as Bought -> Delete from List + Add to Pantry
             
             // 1. Delete from List
             await mutateShopping({
                 action: 'DELETE',
                 item: { id: item.db_id },
                 user_id: user.id
             });

             // 2. Add to Pantry
             await mutatePantryItem({
                 action: 'UPSERT',
                 item: {
                     household_id: householdId || undefined,
                     user_id: user.id,
                     name: item.name,
                     category: item.name,
                     temp_id: crypto.randomUUID()
                 },
                 user_id: user.id
             });
             toast.success(`${item.name} purchased & added to pantry`);

        } else if (item.category === 'Pantry Restock' && item.db_id) {
            // ACTION: Suggestion accepted -> Refill Pantry directly
            await mutatePantryVerify({
                pantry_id: item.db_id,
                status: 'active',
                user_id: user.id
            });
            toast.success(`${item.name} restocked`);
        
        } else {
             // ACTION: Plan/Smart Item -> Add to Shopping List
             await mutateShopping({
                 action: 'UPSERT',
                 item: {
                     household_id: householdId || undefined,
                     name: item.name,
                     added_by: user.id,
                     temp_id: crypto.randomUUID()
                 },
                 user_id: user.id
             });
             toast.success(`${item.name} added to shared list`);
        }

      // Remove from UI
      setItems(prev => prev.filter(i => i.id !== item.id));

    } catch (err) {
      console.error("Failed to update inventory", err);
      toast.error("Failed to update inventory. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleManualAdd = async (name: string) => {
     const { data: { user } } = await supabase.auth.getUser();
     if (!user || !householdId) return;

     // Optimistic UI
     const tempId = crypto.randomUUID();
     const newItem: ShoppingItem = {
         id: `list-${tempId}`,
         type: 'db_list',
         name: name,
         category: 'Shared List',
         reason: 'Manual Add'
     };
     setItems(prev => [newItem, ...prev]);

     try {
         const { mutateShopping } = await import('@/lib/offline/mutations');
         await mutateShopping({
             action: 'UPSERT',
             item: {
                 household_id: householdId || undefined,
                 name: name,
                 added_by: user.id,
                 temp_id: tempId
             },
             user_id: user.id
         });
         toast.success("Item added");
     } catch (e) {
         console.error("Add failed", e);
         toast.error("Failed to add item");
         setItems(prev => prev.filter(i => i.id !== `list-${tempId}`));
     }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Syncing Lists...</div>;

  // 2. Generate Smart List via Edge Function
  const handleGenerateSmartList = async () => {
    setLoading(true);
    setProcessingId('generating');
    const toastId = toast.loading("Analyzing metabolism & pantry...");
    
    try {
        // 1. Ensure Valid Session & Token
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!session || sessionError) {
            throw new Error("Please log in again to use Smart Gen.");
        }

        const token = session.access_token;
        if (!token) throw new Error("No access token found.");

        const { data, error } = await supabase.functions.invoke('shopping-generator', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        
        // 1. Handle Transport Error (500s that Supabase catches)
        if (error) throw error;

        // 2. Handle Application Error (200 OK but failure: true)
        if (data?.failure || data?.error) {
            throw new Error(data.error || "Generation Failed");
        }
        
        const suggestions = data.suggestions || [];
        if (suggestions.length === 0) {
            toast.info("Your list looks optimal! No suggestions needed.", { id: toastId });
            return;
        }

        const newItems: ShoppingItem[] = suggestions.map((s: any, i: number) => ({
            id: `smart-${i}-${Date.now()}`,
            type: 'suggestion',
            name: s.name,
            category: 'Smart Suggestion',
            reason: s.reason,
            priority: s.priority
        }));

        // Filter out dupes
        const uniqueNew = newItems.filter(n => !items.some(existing => existing.name.toLowerCase() === n.name.toLowerCase()));
        
        if (uniqueNew.length === 0) {
            toast.info("Suggestions already in list.", { id: toastId });
        } else {
            setItems(prev => [...uniqueNew, ...prev]);
            toast.success(`Generated ${uniqueNew.length} smart suggestions!`, { id: toastId });
        }

    } catch (e: any) {
        console.error("Smart Gen Error:", e);
        
        // Detailed Error Extraction
        let msg = e.message || "Unknown Error";
        
        // If it's a Supabase FunctionsHttpError, the body is inconsistent.
        // But since we moved to returning 200 OK for logical errors, 
        // this catch block mainly catches network issues or true crashes.
        
        toast.error(`Smart Gen Failed: ${msg}`, { 
            id: toastId,
            duration: 8000, // Longer duration to read
            action: {
                label: 'Retry',
                onClick: () => handleGenerateSmartList()
            }
        });
    } finally {
        setLoading(false);
        setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6 pb-32 text-foreground">
       <div className="fixed top-0 left-0 w-full h-[50vh] bg-purple-900/10 blur-[100px] pointer-events-none" />
       
      <header className="flex items-center justify-between mb-8 mt-4 relative z-10">
        <div>
            <h1 className="text-3xl font-light tracking-tight text-white">Shopping</h1>
            <div className="flex items-center gap-2 text-zinc-500 text-sm mt-1">
                <Users className="h-4 w-4" />
                <span>Household Sync Active</span>
            </div>
        </div>
        
        <button 
            onClick={handleGenerateSmartList}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg shadow-lg hover:brightness-110 disabled:opacity-50 transition-all font-medium"
        >
            {processingId === 'generating' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            <span>Smart Gen</span>
        </button>
      </header>

      {/* Manual Add Input */}
      <div className="relative mb-8 z-10 group">
          <input 
            type="text" 
            placeholder="Add to shared list..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 pl-5 pr-14 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-colors"
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    handleManualAdd(e.currentTarget.value);
                    e.currentTarget.value = '';
                }
            }}
          />
          <div className="absolute right-4 top-4 text-purple-500 pointer-events-none group-focus-within:text-purple-400 transition-colors">
              <Plus className="h-6 w-6" />
          </div>
      </div>
      
      <div className="space-y-3 relative z-10">
        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4 border border-zinc-800">
                <CheckCircle className="text-emerald-500 h-8 w-8 opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-zinc-300">All Clear</h3>
            <p className="text-zinc-500 mt-2">Everything is stocked up.</p>
          </div>
        ) : (
            <AnimatePresence mode='popLayout'>
            {items.map(item => (
            <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                key={item.id} 
                className={`flex items-center justify-between p-4 rounded-xl border backdrop-blur-md transition-all ${
                    item.category === 'Shared List' 
                    ? 'bg-purple-500/10 border-purple-500/20' 
                    : item.category === 'Smart Suggestion'
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-white/5 border-white/5'
                }`}
            >
                <div className="flex-1 min-w-0 mr-4">
                <div className="font-medium text-zinc-100 text-lg flex items-center gap-2 truncate">
                    {item.name}
                </div>
                <div className={`text-[10px] inline-flex items-center px-2 py-0.5 rounded-full mt-1 font-bold uppercase tracking-wider ${
                    item.category === 'Pantry Restock' ? 'text-red-400 bg-red-950/30' : 
                    item.category === 'Shared List' ? 'text-purple-300 bg-purple-900/30' :
                    item.category === 'Smart Suggestion' ? 'text-amber-300 bg-amber-900/30' :
                    'text-blue-400 bg-blue-900/30'
                }`}>
                    {item.category === 'Smart Suggestion' && <Sparkles className="w-3 h-3 mr-1" />}
                    {item.reason}
                </div>
                </div>
                <button 
                onClick={() => handleAction(item)}
                disabled={!!processingId}
                className="text-zinc-500 hover:text-emerald-400 transition-colors p-2 disabled:opacity-50 flex-shrink-0"
                >
                {processingId === item.id ? (
                    <Loader2 className="animate-spin" size={24} />
                ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-zinc-600 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-all">
                        {item.category === 'Shared List' ? <CheckCircle size={16} className="opacity-0 hover:opacity-100" /> : <Plus size={16} />}
                    </div>
                )}
                </button>
            </motion.div>
            ))}
            </AnimatePresence>
        )}
      </div>
    </div>
  );
}

