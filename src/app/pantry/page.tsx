'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { applyPantryEntropy, isGhost, PantryItem } from '@/lib/engine/pantry/entropy';
import { Trash2, CheckCircle, RefreshCcw, Plus, X, ScanLine, Calendar } from 'lucide-react';
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

    const { data } = await supabase
      .from('pantry')
      .select('*')
      .eq('user_id', user.id);

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

    await supabase.from('pantry').insert({
      user_id: user.id,
      name: name,
      category: name, // simplified
      probability_score: 1.0,
      status: 'active',
      expires_at: expiryDate || null
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

  return (
    <div className="min-h-screen bg-[var(--palenight-bg)] p-4 text-zinc-100 pb-24 relative">
      <header className="mb-6 mt-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Pantry</h1>
          <p className="text-zinc-400 text-sm">Inventory & Physics</p>
        </div>
        <div className="flex gap-2">
             <Button 
                variant="outline"
                className="rounded-full border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 h-10 w-10 p-2"
                onClick={handleCameraScan}
              >
                {isScanning ? <RefreshCcw className="animate-spin h-5 w-5" /> : <ScanLine className="h-5 w-5" />}
              </Button>
            <Button 
                className="rounded-full bg-blue-600 hover:bg-blue-500 shadow-lg h-10 w-10 p-2"
                onClick={() => setIsAdding(true)}
            >
                <Plus className="h-6 w-6" />
            </Button>
        </div>
      </header>

      {/* SCAN RESULTS MODAL */}
      {scanResult.length > 0 && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
            <div className="w-full max-w-md bg-[var(--palenight-surface)] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
                <h3 className="text-xl font-bold text-white">Scanned Items</h3>
                <div className="max-h-60 overflow-y-auto space-y-2">
                    {scanResult.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-xs text-zinc-400">{item.expiry_estimate || 'No expiry info'}</span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 mt-4">
                    <Button variant="ghost" onClick={() => setScanResult([])} className="flex-1">Cancel</Button>
                    <Button onClick={confirmScannedItems} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white">Add All</Button>
                </div>
            </div>
         </div>
      )}

      {/* ADD ITEM DIALOG */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
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
              <div className="space-y-2">
                <Label>Expiry Date (Optional)</Label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input 
                        type="date"
                        value={newItemExpiry}
                        onChange={e => setNewItemExpiry(e.target.value)}
                        className="bg-[var(--palenight-bg)] border-white/10 pl-10"
                    />
                </div>
              </div>
              <Button type="submit" className="w-full bg-[var(--palenight-accent)] hover:brightness-110 text-white font-bold h-12 rounded-lg">Add to Pantry</Button>
            </form>
          </div>
        </div>
      )}

      {/* GHOST / REVIEW SECTION */}
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

       {/* MAIN LIST */}
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
                  <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                      <span>Verified: {new Date(item.last_verified_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>
                      {item.expires_at && (
                          <span className={`px-1.5 py-0.5 rounded ${new Date(item.expires_at) < new Date() ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>
                              Exp: {new Date(item.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                          </span>
                      )}
                  </div>
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
