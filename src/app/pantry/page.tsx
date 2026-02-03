'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { applyPantryEntropy, isGhost, PantryItem } from '@/lib/engine/pantry/entropy';
import { Trash2, CheckCircle, RefreshCcw } from 'lucide-react';

// Client-side supabase for the UI
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPantry();
  }, []);

  async function fetchPantry() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('pantry')
      .select('*')
      .eq('user_id', user.id);

    if (data) {
      // Calculate current entropy before displaying
      // In a real app, this might be done via a highly efficient view or scheduled job,
      // but client-side calculation ensures immediate responsiveness to time.
      const updatedItems = applyPantryEntropy(data as unknown as PantryItem[]);
      setItems(updatedItems);
    }
    setLoading(false);
  }

  async function verifyItem(id: string) {
    // Reset probability to 1.0
    await supabase.from('pantry').update({
      probability_score: 1.0,
      last_verified_at: new Date().toISOString()
    }).eq('id', id);
    fetchPantry();
  }

  async function removeItem(id: string) {
    await supabase.from('pantry').delete().eq('id', id);
    fetchPantry();
  }

  const reviewNeeded = items.filter(i => isGhost(i.probability_score));
  const goodItems = items.filter(i => !isGhost(i.probability_score));

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading Pantry...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 p-4 text-zinc-100 pb-24">
      <header className="mb-8 mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-white">Smart Pantry</h1>
        <p className="text-zinc-400">Physics-based inventory decay</p>
      </header>

      {/* GHOST CHECK SECTION */}
      {reviewNeeded.length > 0 && (
        <section className="mb-8 rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
          <h2 className="mb-3 flex items-center text-lg font-semibold text-amber-400">
            <RefreshCcw className="mr-2 h-5 w-5" />
            Review Needed ({reviewNeeded.length})
          </h2>
          <div className="space-y-3">
            {reviewNeeded.map(item => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-black/40 p-3">
                <div>
                  <h3 className="font-medium">{item.category} (ID: {item.id.slice(0, 4)})</h3>
                  <div className="text-xs text-amber-500/80">Prob: {(item.probability_score * 100).toFixed(0)}%</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => removeItem(item.id)} className="rounded-full bg-red-900/30 p-2 text-red-400 hover:bg-red-900/50">
                    <Trash2 size={18} />
                  </button>
                  <button onClick={() => verifyItem(item.id)} className="rounded-full bg-emerald-900/30 p-2 text-emerald-400 hover:bg-emerald-900/50">
                    <CheckCircle size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MAIN INVENTORY */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Stocked Items</h2>
        <div className="grid gap-3">
          {goodItems.map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div>
                <h3 className="font-medium">{item.category}</h3>
                <div className="text-xs text-zinc-500">
                  Prob: {(item.probability_score * 100).toFixed(0)}%
                </div>
              </div>
              {/* Small quick actions could go here */}
              <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${item.probability_score * 100}%` }}
                />
              </div>
            </div>
          ))}
          {goodItems.length === 0 && (
            <div className="py-8 text-center text-zinc-500 italic">No healthy items in pantry</div>
          )}
        </div>
      </section>
    </div>
  );
}
