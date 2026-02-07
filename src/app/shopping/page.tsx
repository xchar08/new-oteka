'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, Loader2, Plus, Users, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ShoppingItem = {
  id: string; // "pantry-{id}" or "plan-{id}" or "list-{id}"
  type: 'db_list' | 'suggestion';
  db_id?: number; // Real DB ID for shopping_list or pantry items
  name: string;
  category: 'Shared List' | 'Pantry Restock' | 'Meal Plan';
  reason: string;
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
        // RLS handles household filtering now, but we can be explicit if needed.
        // For simplicity, rely on RLS + user association
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
        if (item.type === 'db_list') {
            // ACTION: Mark as Bought -> Add to Pantry
             // 1. Mark checked in shopping_list (or delete?) -> Let's delete for now to keep it clean
             await supabase.from('shopping_list').delete().eq('id', item.db_id);

             // 2. Add to Pantry (Refill)
             // Check if exists in Pantry logic needed? Or just Blind Insert?
             // Let's doing a smart insert/update
             
             // ... (Reuse logic from Pantry) ...
             // For brevity, we assume "Bought" implies "Full Probability"
             // But we need to link content. 
             // We'll treat it as a "New Item" insert for now unless we do fuzzy matching.
             
             // Check if food exists
             let foodId: number;
             const { data: existingFood } = await supabase.from('foods').select('id').ilike('name', item.name).single();
             if (existingFood) {
                 foodId = existingFood.id;
             } else {
                 const { data: newFood } = await supabase.from('foods').insert({ name: item.name }).select('id').single();
                 foodId = newFood!.id;
             }

             await supabase.from('pantry').insert({
                 user_id: user.id,
                 household_id: householdId,
                 food_id: foodId,
                 name: item.name,
                 probability_score: 1.0, 
                 status: 'active'
             });

        } else if (item.category === 'Pantry Restock' && item.db_id) {
            // ACTION: Suggestion accepted -> Refill Pantry directly
            await supabase
                .from('pantry')
                .update({ probability_score: 1.0, last_verified_at: new Date().toISOString() })
                .eq('id', item.db_id);
        
        } else {
             // ACTION: Plan Item -> Add to Shopping List (Persistence)
             // Wait, if I click check on a plan item, did I buy it? 
             // Logic: Check = "I Bought It".
             // So same as DB_LIST logic: Add to Pantry.
             
             let foodId: number;
             const { data: existingFood } = await supabase.from('foods').select('id').ilike('name', item.name).single();
             if (existingFood) {
                 foodId = existingFood.id;
             } else {
                 const { data: newFood } = await supabase.from('foods').insert({ name: item.name }).select('id').single();
                 foodId = newFood!.id;
             }

             await supabase.from('pantry').insert({
                 user_id: user.id,
                 household_id: householdId,
                 food_id: foodId,
                 name: item.name,
                 probability_score: 1.0,
                 status: 'active'
             });
        }

      // Remove from UI
      setItems(prev => prev.filter(i => i.id !== item.id));

    } catch (err) {
      console.error("Failed to update inventory", err);
      alert("Failed to update. Try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleManualAdd = async (name: string) => {
     // Add to DB List
     const { data: { user } } = await supabase.auth.getUser();
     if (!user || !householdId) return;

     const { data: added } = await supabase.from('shopping_list').insert({
         household_id: householdId,
         name: name,
         added_by: user.id
     }).select().single();

     if (added) {
         setItems(prev => [{
             id: `list-${added.id}`,
             type: 'db_list',
             db_id: added.id,
             name: added.name,
             category: 'Shared List',
             reason: 'Manual Add'
         }, ...prev]);
     }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Syncing Lists...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 p-6 pb-32 text-zinc-100">
       <div className="fixed top-0 left-0 w-full h-[50vh] bg-purple-900/10 blur-[100px] pointer-events-none" />
       
      <header className="mb-8 mt-4 relative z-10">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-light tracking-tight text-white">Shopping</h1>
                <div className="flex items-center gap-2 text-zinc-500 text-sm mt-1">
                    <Users className="h-4 w-4" />
                    <span>Household Sync Active</span>
                </div>
            </div>
            <div className="bg-purple-500/10 p-3 rounded-full text-purple-400 border border-purple-500/20">
                <ShoppingCart className="h-6 w-6" />
            </div>
        </div>
      </header>

      {/* Manual Add Input */}
      <div className="relative mb-8 z-10">
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
          <div className="absolute right-4 top-4 text-purple-500 pointer-events-none">
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
                className={`flex items-center justify-between p-4 rounded-xl border backdrop-blur-md ${
                    item.category === 'Shared List' 
                    ? 'bg-purple-500/10 border-purple-500/20' 
                    : 'bg-white/5 border-white/5'
                }`}
            >
                <div>
                <div className="font-medium text-zinc-100 text-lg flex items-center gap-2">
                    {item.name}
                </div>
                <div className={`text-[10px] inline-block px-2 py-0.5 rounded-full mt-1 font-bold uppercase tracking-wider ${
                    item.category === 'Pantry Restock' ? 'text-red-400 bg-red-950/30' : 
                    item.category === 'Shared List' ? 'text-purple-300 bg-purple-900/30' :
                    'text-blue-400 bg-blue-900/30'
                }`}>
                    {item.reason}
                </div>
                </div>
                <button 
                onClick={() => handleAction(item)}
                disabled={!!processingId}
                className="text-zinc-500 hover:text-emerald-400 transition-colors p-2 disabled:opacity-50"
                >
                {processingId === item.id ? (
                    <Loader2 className="animate-spin" size={24} />
                ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-zinc-600 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-all">
                        <CheckCircle size={16} className="opacity-0 hover:opacity-100" />
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

