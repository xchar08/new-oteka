'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, Loader2 } from 'lucide-react';

type ShoppingItem = {
  id: string; // "pantry-{id}" or "plan-{name}"
  original_id?: number; // Real DB ID for pantry items
  name: string;
  category: 'Pantry Restock' | 'Meal Plan';
  reason: string;
};

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const supabase = createClient();

  // 1. Load Data
  useEffect(() => {
    async function generateList() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const generatedItems: ShoppingItem[] = [];

      // A. Fetch Depleted Pantry Items (< 0.3)
      const { data: depletedPantry } = await supabase
        .from('pantry')
        .select('id, probability_score, foods ( name )')
        .eq('status', 'active')
        .lt('probability_score', 0.3);

      if (depletedPantry) {
        depletedPantry.forEach((p: any) => {
          generatedItems.push({
            id: `pantry-${p.id}`,
            original_id: p.id,
            name: p.foods?.name || 'Unknown Item',
            category: 'Pantry Restock',
            reason: `Running Low (${(p.probability_score * 100).toFixed(0)}%)`
          });
        });
      }

      // B. Fetch Latest Plan Items
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
          // Dedup: Don't add if already in pantry list
          if (!generatedItems.some(i => i.name.toLowerCase() === itemName.toLowerCase())) {
            generatedItems.push({
              id: `plan-${itemName}-${idx}`,
              name: itemName,
              category: 'Meal Plan',
              reason: 'Required for Plan'
            });
          }
        });
      }

      setItems(generatedItems);
      setLoading(false);
    }
    generateList();
  }, []);

  // 2. Handle Check-Off (The "Real App" Logic)
  const handleCheckOff = async (item: ShoppingItem) => {
    setProcessingId(item.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (item.category === 'Pantry Restock' && item.original_id) {
        // CASE A: Existing item -> Refill (Probability = 1.0)
        await supabase
          .from('pantry')
          .update({ 
            probability_score: 1.0, 
            last_verified_at: new Date().toISOString() 
          })
          .eq('id', item.original_id);

      } else {
        // CASE B: New item -> Insert into Foods & Pantry
        // 1. Find or Create Food
        let foodId: number;
        
        const { data: existingFood } = await supabase
          .from('foods')
          .select('id')
          .ilike('name', item.name) // Case-insensitive match
          .single();

        if (existingFood) {
          foodId = existingFood.id;
        } else {
          // Create new food entry
          const { data: newFood } = await supabase
            .from('foods')
            .insert({ 
              name: item.name,
              density_coefficient: 1.0, // Default until vision corrects it
              category_decay_rate: 0.05 
            })
            .select('id')
            .single();
          foodId = newFood!.id;
        }

        // 2. Add to Pantry
        await supabase.from('pantry').insert({
          user_id: user.id,
          food_id: foodId,
          probability_score: 1.0,
          status: 'active'
        });
      }

      // Remove from UI after successful DB update
      setItems(prev => prev.filter(i => i.id !== item.id));

    } catch (err) {
      console.error("Failed to update inventory", err);
      alert("Failed to update inventory. Try again.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Analyzing Inventory...</div>;

  return (
    <div className="p-6 max-w-lg mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-6">Smart Shopping</h1>
      
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
            <div>
              <div className="font-semibold text-gray-900">{item.name}</div>
              <div className={`text-xs inline-block px-2 py-0.5 rounded mt-1 font-medium ${
                item.category === 'Pantry Restock' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {item.reason}
              </div>
            </div>
            <button 
              onClick={() => handleCheckOff(item)}
              disabled={!!processingId}
              className="text-gray-400 hover:text-green-600 transition p-2 disabled:opacity-50"
            >
              {processingId === item.id ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <CheckCircle size={28} />
              )}
            </button>
          </div>
        ))}
        
        {items.length === 0 && (
          <div className="text-center py-10">
            <div className="text-green-600 text-5xl mb-4">✨</div>
            <h3 className="text-lg font-semibold text-gray-900">All Optimized</h3>
            <p className="text-gray-500 mt-2">Inventory updated. System fully synced.</p>
          </div>
        )}
      </div>
    </div>
  );
}
