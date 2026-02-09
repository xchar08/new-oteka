'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { applyPantryEntropy, isGhost, PantryItem } from '@/lib/engine/pantry/entropy';
import { Trash2, CheckCircle, RefreshCcw, Plus, X, ScanLine, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';


export default function PantryPage() {
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  
  // Modals / States
  const [isAdding, setIsAdding] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any[]>([]); // Items from vision

  // Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemExpiry, setNewItemExpiry] = useState('');
  
  const supabase = createClient();

  useEffect(() => {
    fetchPantry();
  }, []);

  async function fetchPantry() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }

    // 1. Get Household ID
    const { data: userData } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', user.id)
      .single();

    const hId = userData?.household_id;
    setHouseholdId(hId);

    // 2. Fetch Pantry (User OR Household)
    let query = supabase.from('pantry').select('*');
    
    if (hId) {
      query = query.eq('household_id', hId);
    } else {
      query = query.eq('user_id', user.id);
    }

    const { data } = await query;

    if (data) {
      const updatedItems = applyPantryEntropy(data as unknown as PantryItem[]);
      setItems(updatedItems);
    }
    setLoading(false);
  }

  // --- MANUAL ADD ---
  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemName.trim()) return;

    await savePantryItem(newItemName, newItemExpiry);

    setNewItemName('');
    setNewItemExpiry('');
    setIsAdding(false);
    fetchPantry();
  }

  // --- SCANNER LOGIC ---
  const handleCameraScan = async () => {
    try {
      setIsScanning(true);
      const image = await CapacitorCamera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera // Or prompt
      });

      if (image.base64String) {
         await processPantryImage(image.base64String);
      }
    } catch (e) {
      console.warn("User cancelled or camera failed", e);
      setIsScanning(false);
    }
  };

  const processPantryImage = async (base64: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/vision-pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64, mode: 'pantry' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');

      // Expecting { pantry_items: [{ name, category, expiry_estimate }] }
      if (data.pantry_items) {
        setScanResult(data.pantry_items);
        setIsScanning(false); // Close generic loading, open review modal potentially?
        // For simplicity v1: Just add them all or let user verify in a list?
        // Let's autosave for "magic" feel or prompt. 
        // prompt is safer.
      } else {
        alert("No items identified");
        setIsScanning(false);
      }

    } catch (err) {
      alert('Pantry Scan Failed. Try manual entry.');
      setIsScanning(false);
    }
  };

  const savePantryItem = async (name: string, expiryDate?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic UI Update (Optional, but good for perceived speed)
    // We rely on fetchPantry() called after specific flow, or could append to local state.
    // Given the scan flow refetches, we'll let that happen.

    const { mutatePantryItem } = await import('@/lib/offline/mutations');
    await mutatePantryItem({
        action: 'UPSERT',
        item: {
            household_id: householdId,
            user_id: user.id,
            name: name,
            category: name, // simplified
            expiry: expiryDate,
            temp_id: crypto.randomUUID()
        },
        user_id: user.id
    });
  };

  const confirmScannedItems = async () => {
    setIsScanning(true); // show loading
    for (const item of scanResult) {
       // Estimate expiry date from "7 days" string if needed, or just leave null
       // For now, simple insert
       await savePantryItem(item.name);
    }
    setScanResult([]);
    setIsScanning(false);
    fetchPantry();
  };

  // --- DELETE / VERIFY ---
  // --- DELETE / VERIFY ---
  async function verifyItem(id: string) {
    /*
    await supabase.from('pantry').update({
      probability_score: 1.0,
      last_verified_at: new Date().toISOString()
    }).eq('id', id);
    */
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { mutatePantryVerify } = await import('@/lib/offline/mutations');
    await mutatePantryVerify({
        pantry_id: Number(id),
        status: 'active',
        user_id: user.id
    });

    fetchPantry();
  }

  async function removeItem(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic Update
    setItems(items.filter(i => i.id !== Number(id)));

    const { mutatePantryItem } = await import('@/lib/offline/mutations');
    await mutatePantryItem({
        action: 'DELETE',
        item: { id: Number(id) },
        user_id: user.id
    });
    
    // fetchPantry(); // No need if we optimistically removed
  }

  const reviewNeeded = items.filter(i => isGhost(i.probability_score));
  const goodItems = items.filter(i => !isGhost(i.probability_score));

  return (
    <div className="min-h-screen bg-background p-6 text-foreground pb-32">
       {/* Background Glow */}
       <div className="fixed top-0 left-0 w-full h-[50vh] bg-primary/5 blur-[100px] pointer-events-none" />

      <header className="mb-8 mt-4 flex justify-between items-end relative z-10">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Pantry</h1>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
             <Users className="h-4 w-4" />
             <span>Household Sync Active</span>
          </div>
        </div>
        <div className="flex gap-3">
             <Button 
                variant="outline"
                className="rounded-full border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10 h-12 w-12 p-0"
                onClick={() => router.push('/pantry/scan')}
              >
                <ScanLine className="h-5 w-5" />
              </Button>
            <Button 
                className="rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-900/20 h-12 w-12 p-0 text-zinc-950"
                onClick={() => setIsAdding(true)}
            >
                <Plus className="h-6 w-6" />
            </Button>
        </div>
      </header>

      {/* SCAN RESULTS MODAL */}
      {scanResult.length > 0 && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl">
                <h3 className="text-xl font-bold text-white">Scanned Items</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                    {scanResult.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                            <span className="font-medium text-zinc-200">{item.name}</span>
                            <span className="text-xs text-zinc-500">{item.expiry_estimate || 'No expiry info'}</span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setScanResult([])} className="flex-1 rounded-xl hover:bg-white/5 text-zinc-400">Cancel</Button>
                    <Button onClick={confirmScannedItems} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl font-bold">Add All</Button>
                </div>
            </div>
         </div>
      )}

      {/* ADD ITEM DIALOG */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl mb-safe sm:mb-0">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Add Item</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                  <X className="text-zinc-400 h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Item Name</Label>
                <Input 
                  autoFocus
                  placeholder="e.g. Greek Yogurt" 
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="bg-zinc-950 border-white/10 h-12 rounded-xl text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Expiry Date (Optional)</Label>
                <div className="relative">
                    <Calendar className="absolute left-4 top-4 h-4 w-4 text-zinc-500" />
                    <Input 
                        type="date"
                        value={newItemExpiry}
                        onChange={e => setNewItemExpiry(e.target.value)}
                        className="bg-zinc-950 border-white/10 pl-12 h-12 rounded-xl"
                    />
                </div>
              </div>
              <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold h-12 rounded-xl text-md shadow-lg shadow-emerald-900/20">
                  Add to Pantry
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* GHOST / REVIEW SECTION */}
      {reviewNeeded.length > 0 && (
        <section className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 backdrop-blur-md">
          <h2 className="mb-3 flex items-center text-xs font-bold uppercase tracking-widest text-amber-500">
            <RefreshCcw className="mr-2 h-4 w-4" /> Review Needed
          </h2>
          <div className="space-y-2">
            {reviewNeeded.map(item => (
              <div key={item.id} className="flex items-center justify-between rounded-xl bg-zinc-950/50 p-3 border border-amber-500/10">
                <div>
                  <h3 className="font-medium text-amber-200">{item.name || item.category}</h3>
                  <div className="text-xs text-amber-500/60 font-mono mt-0.5">Confidence: {(item.probability_score * 100).toFixed(0)}%</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => removeItem(item.id)} className="rounded-full bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20 transition-colors">
                    <Trash2 size={16} />
                  </button>
                  <button onClick={() => verifyItem(item.id)} className="rounded-full bg-emerald-500/10 p-2 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                    <CheckCircle size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

       {/* MAIN LIST */}
      <section className="space-y-3">
        <AnimatePresence mode='popLayout'>
        {goodItems.length > 0 ? (
          goodItems.map((item, i) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.05 }}
              key={item.id} 
              className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-md group"
            >
              <div className="flex justify-between items-start z-10 relative">
                <div>
                  <h3 className="font-medium text-zinc-100 text-lg">{item.name || item.category}</h3>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                      <span>Verified: {new Date(item.last_verified_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>
                      {item.expires_at && (
                          <span className={`px-2 py-0.5 rounded-md font-medium ${new Date(item.expires_at) < new Date() ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>
                              Exp: {new Date(item.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                          </span>
                      )}
                  </div>
                </div>
                <div className="bg-zinc-950/50 text-zinc-500 font-mono text-xs px-2 py-1 rounded-lg border border-white/5">
                   {(item.probability_score * 100).toFixed(0)}%
                </div>
              </div>
              
              {/* Decay Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700"
                  style={{ width: `${item.probability_score * 100}%` }}
                />
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-zinc-600 space-y-4"
          >
            <div className="h-20 w-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <RefreshCcw className="h-8 w-8 opacity-20" />
            </div>
            <p>Pantry is empty.</p>
            <Button variant="outline" onClick={() => setIsAdding(true)} className="border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl">
              Add First Item
            </Button>
          </motion.div>
        )}
        </AnimatePresence>
      </section>
    </div>
  );
}

