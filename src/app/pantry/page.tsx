'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { applyPantryEntropy, isGhost, PantryItem } from '@/lib/engine/pantry/entropy';
import { Trash2, CheckCircle, RefreshCcw, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';

import { useRouter } from 'next/navigation';

export default function PantryPage() {
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  
  const supabase = createClient();

  useEffect(() => {
    fetchPantry();
  }, []);

  async function fetchPantry() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Pantry Fetch - User:', user?.id);
    
    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('pantry')
      .select('*')
      .eq('user_id', user.id);

    console.log('Pantry Fetch - Data:', data);
    console.log('Pantry Fetch - Error:', error);

    if (data) {
      const updatedItems = applyPantryEntropy(data as unknown as PantryItem[]);
      setItems(updatedItems);
    }
    setLoading(false);
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('pantry').insert({
      user_id: user.id,
      name: newItemName, // simple name fallback
      category: newItemName, // temporarily use name as category
      probability_score: 1.0,
      status: 'active'
    });

    setNewItemName('');
    setIsAdding(false);
    fetchPantry();
  }

  async function verifyItem(id: string) {
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

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-[var(--palenight-bg)] text-zinc-400">
      <RefreshCcw className="animate-spin mr-2" /> Loading Pantry...
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--palenight-bg)] p-4 text-zinc-100 pb-24 relative">
      <header className="mb-6 mt-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Smart Pantry</h1>
          <p className="text-zinc-400 text-sm">Physics-based inventory decay</p>
        </div>
        <Button 
          className="rounded-full bg-blue-600 hover:bg-blue-500 shadow-lg h-10 w-10 p-2"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </header>

      {/* ADD ITEM DIALOG (Simplified Overlay) */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[var(--palenight-surface)] border border-white/10 rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Add Item</h3>
              <button onClick={() => setIsAdding(false)}><X className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="space-y-2">
                <Label>Item Name</Label>
                <Input 
                  autoFocus
                  placeholder="e.g. Greek Yogurt" 
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="bg-[var(--palenight-bg)] border-white/10"
                />
              </div>
              <Button type="submit" className="w-full bg-[var(--palenight-accent)] hover:brightness-110 text-white font-bold">Add to Pantry</Button>
            </form>
          </div>
        </div>
      )}

      {/* GHOST CHECK SECTION */}
      {reviewNeeded.length > 0 && (
        <section className="mb-6 rounded-xl border border-[var(--palenight-warning)]/50 bg-[var(--palenight-warning)]/10 p-4">
          <h2 className="mb-3 flex items-center text-sm font-bold uppercase tracking-wider text-[var(--palenight-warning)]">
            <RefreshCcw className="mr-2 h-4 w-4" /> Review Needed
          </h2>
          <div className="space-y-2">
            {reviewNeeded.map(item => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-black/40 p-3 border border-[var(--palenight-warning)]/30">
                <div>
                  <h3 className="font-medium text-amber-100">{item.name || item.category}</h3>
                  <div className="text-xs text-amber-500/80">Probability: {(item.probability_score * 100).toFixed(0)}%</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => removeItem(item.id)} className="rounded-full bg-red-950 p-2 text-red-400">
                    <Trash2 size={16} />
                  </button>
                  <button onClick={() => verifyItem(item.id)} className="rounded-full bg-emerald-950 p-2 text-emerald-400">
                    <CheckCircle size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

       {/* GHOST CHECK SECTION */}
      <section className="space-y-3">
        <AnimatePresence mode='popLayout'>
        {goodItems.length > 0 ? (
          goodItems.map(item => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={item.id} 
              className="relative overflow-hidden rounded-xl border border-white/5 bg-[var(--palenight-surface)] p-4 shadow-md"
            >
              <div className="flex justify-between items-start z-10 relative">
                <div>
                  <h3 className="font-medium text-zinc-100">{item.name || item.category}</h3>
                  <div className="text-xs text-zinc-500 mt-1">Verified: {new Date(item.last_verified_at).toLocaleDateString()}</div>
                </div>
                <div className="bg-[var(--palenight-bg)] text-zinc-400 text-xs px-2 py-1 rounded">
                   {(item.probability_score * 100).toFixed(0)}%
                </div>
              </div>
              
              {/* Decay Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--palenight-bg)]">
                <div
                  className="h-full bg-gradient-to-r from-[var(--palenight-success)] to-[var(--palenight-secondary)]"
                  style={{ width: `${item.probability_score * 100}%` }}
                />
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-4"
          >
            <div className="h-16 w-16 rounded-full bg-[var(--palenight-surface)] flex items-center justify-center">
              <RefreshCcw className="h-8 w-8 opacity-20" />
            </div>
            <p>Pantry is empty.</p>
            <Button variant="outline" onClick={() => setIsAdding(true)} className="border-white/10 text-zinc-400 hover:text-white hover:bg-[var(--palenight-surface)]">
              Add First Item
            </Button>
          </motion.div>
        )}
        </AnimatePresence>
      </section>
    </div>
  );
}
