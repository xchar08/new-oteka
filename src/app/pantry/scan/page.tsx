'use client';

import { useState, useEffect, useRef } from 'react';
import { CameraPreview } from '@capacitor-community/camera-preview';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { HandOverlay } from '@/components/vision/HandOverlay';
import { Loader2, RefreshCw, ChevronLeft, Check, Camera, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { ScanningGrid } from '@/components/vision/ScanningGrid';
import { motion, AnimatePresence } from 'framer-motion';

interface PantryItemDraft {
    id: string; // Temp ID
    name: string;
    quantity: string;
    expiry: string;
    checked: boolean;
    ingredients?: string[];
}

export default function PantryScanPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  // Multi-Select State
  const [scannedItems, setScannedItems] = useState<PantryItemDraft[]>([]);
  const [showResults, setShowResults] = useState(false);

  const [debugLog, setDebugLog] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const supabase = createClient();
  const router = useRouter();
  const isMounted = useRef(true);
  const isProcessing = useRef(false);

  // --- SAVE BATCH LOGIC ---
  const handleSaveBatch = async () => {
    const itemsToSave = scannedItems.filter(i => i.checked);
    if (itemsToSave.length === 0) return;

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data: userData } = await supabase
        .from('users')
        .select('household_id')
        .eq('id', user.id)
        .single();

      const inserts = itemsToSave.map(item => ({
        user_id: user.id,
        household_id: userData?.household_id,
        name: item.name,
        status: 'active',
        probability_score: 1.0,
        metadata_json: {
           quantity_estimate: item.quantity,
           expiry_text: item.expiry,
           ingredients: item.ingredients || []
        }
      }));

      const { error } = await supabase.from('pantry').insert(inserts);

      if (error) throw error;

      stopCamera();
      router.push('/pantry');
    } catch (err) {
      console.error("Save failed:", err);
      setErrorMsg("Failed to save items.");
      setIsSaving(false);
    }
  };

  const toggleItem = (id: string) => {
      setScannedItems(prev => prev.map(item => 
          item.id === id ? { ...item, checked: !item.checked } : item
      ));
  };

  const updateItem = (id: string, field: keyof PantryItemDraft, value: string) => {
      setScannedItems(prev => prev.map(item => 
          item.id === id ? { ...item, [field]: value } : item
      ));
  };

  const deleteItem = (id: string) => {
      setScannedItems(prev => prev.filter(item => item.id !== id));
  };

  const addItem = () => {
      setScannedItems(prev => [
          ...prev, 
          { id: `manual-${Date.now()}`, name: "New Item", quantity: "Full", expiry: "", checked: true }
      ]);
  };

  // --- CAMERA LIFECYCLE ---
  useEffect(() => {
    isMounted.current = true;
    if (Capacitor.isNativePlatform()) {
      startCamera();
    }
    return () => {
      isMounted.current = false;
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { camera } = await CapacitorCamera.requestPermissions();
        if (camera !== 'granted') return;
      }
      
      await CameraPreview.stop().catch(() => {});
      await CameraPreview.start({
        position: 'rear',
        parent: 'cameraPreview',
        className: 'cameraPreview',
        toBack: true, 
        disableAudio: true,
      });

      if (isMounted.current) {
        document.body.classList.add('camera-active'); 
        document.documentElement.classList.add('camera-active');
        setCameraActive(true);
      }
    } catch (e) {
      console.error('Failed to start camera', e);
    }
  };

  const stopCamera = async () => {
    try {
      await CameraPreview.stop();
    } catch (e) {} 
    finally {
        document.body.classList.remove('camera-active');
        document.documentElement.classList.remove('camera-active');
        if (isMounted.current) setCameraActive(false);
    }
  };

  const handleCapture = async () => {
    if (analyzing || isProcessing.current) return;
    isProcessing.current = true;
    setAnalyzing(true);
    setErrorMsg(null);
    
    try {
      let base64Image = '';
      if (Capacitor.isNativePlatform()) {
        const result = await CameraPreview.capture({ quality: 85 });
        base64Image = result.value;
      } else {
        alert("Native environment required for multi-scan.");
        setAnalyzing(false);
        isProcessing.current = false;
        return;
      }
      await processImage(base64Image);
    } catch (err) {
      setErrorMsg('Capture failed.');
      setAnalyzing(false);
      isProcessing.current = false;
    }
  };

  const processImage = async (base64: string) => {
    const supabaseClient = createClient(); 
    try {
      stopCamera(); 
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Neural Link Down: Missing Supabase Environment Variables.");
      }

      const res = await fetch(
        `${supabaseUrl}/functions/v1/vision-pipeline`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'x-user-token': session?.access_token || ''
          },
          body: JSON.stringify({ image: base64, mode: 'pantry' }),
        }
      );
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");

      const rawItems = data.pantry_items || []; 
      const drafts: PantryItemDraft[] = rawItems.map((item: any, idx: number) => ({
          id: `temp-${Date.now()}-${idx}`,
          name: item.name || "Unknown Item",
          quantity: item.quantity || "Full",
          expiry: item.expiry || "",
          checked: true,
          ingredients: item.ingredients || []
      }));

      if (isMounted.current) {
          setScannedItems(drafts);
          setShowResults(true);
      }
    } catch (err: any) {
       setErrorMsg(err.message);
       startCamera();
    } finally {
       if (isMounted.current) setAnalyzing(false);
       isProcessing.current = false;
    }
  };

  // --- RENDER RESULTS ---
  if (showResults) {
      return (
        <div className="min-h-screen bg-[var(--bg-app)] flex flex-col p-6 animate-in fade-in duration-500 pb-safe transition-colors">
            <header className="flex items-center gap-4 pt-safe mb-6">
                <button onClick={() => { setShowResults(false); startCamera(); }} className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] shadow-sm">
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Verify Scan</h1>
                    <p className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest">Multi-Item Logistics</p>
                </div>
            </header>
            
            <div className="flex-1 overflow-y-auto space-y-4 pb-24 scrollbar-hide">
                <AnimatePresence mode="popLayout">
                    {scannedItems.map((item) => (
                        <motion.div 
                            layout
                            key={item.id} 
                            className={`p-5 rounded-[28px] border transition-all duration-300 ${item.checked ? 'bg-[var(--bg-surface)] border-[var(--primary)] shadow-md' : 'bg-[var(--bg-surface)] border-[var(--border)] opacity-40'}`}
                        >
                            <div className="flex items-start gap-4">
                                <button 
                                    onClick={() => toggleItem(item.id)}
                                    className={`h-7 w-7 rounded-full border-2 flex items-center justify-center mt-1 transition-all ${item.checked ? 'bg-[var(--primary)] border-[var(--primary)]' : 'bg-transparent border-[var(--border)]'}`}
                                >
                                    {item.checked && <Check size={16} className="text-white" />}
                                </button>
                                
                                <div className="flex-1 space-y-3">
                                    <input 
                                        value={item.name} 
                                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                        className="bg-transparent border-none text-lg font-black p-0 h-auto focus:outline-none w-full text-[var(--text-primary)] capitalize"
                                        placeholder="Item Name"
                                    />
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-[var(--bg-app)] border border-[var(--border)] rounded-xl px-3 py-2 flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-[var(--text-secondary)] opacity-50">Quantity</span>
                                            <input value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} className="bg-transparent text-xs font-bold focus:outline-none" />
                                        </div>
                                        <div className="flex-1 bg-[var(--bg-app)] border border-[var(--border)] rounded-xl px-3 py-2 flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-[var(--text-secondary)] opacity-50">Expiry</span>
                                            <input value={item.expiry} onChange={e => updateItem(item.id, 'expiry', e.target.value)} className="bg-transparent text-xs font-bold focus:outline-none" placeholder="None" />
                                        </div>
                                    </div>
                                </div>

                                <button className="text-[var(--text-secondary)] opacity-30 hover:text-[var(--error)] p-2 transition-colors" onClick={() => deleteItem(item.id)}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                <button 
                    onClick={addItem} 
                    className="w-full h-16 border-2 border-dashed border-[var(--border)] rounded-[28px] bg-transparent text-[var(--text-secondary)] flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all"
                >
                    <Plus size={16} /> Add Missing Item
                </button>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-[var(--bg-app)]/80 backdrop-blur-xl border-t border-[var(--border)] flex gap-4 pb-safe z-50">
                <button 
                    className="flex-1 h-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] font-black uppercase tracking-widest text-xs shadow-sm active:scale-95 transition-all"
                    onClick={() => { setShowResults(false); startCamera(); }}
                >
                    Retake
                </button>
                <button 
                    className="flex-[2] h-14 rounded-2xl bg-[var(--primary)] text-white font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                    onClick={handleSaveBatch}
                    disabled={isSaving || scannedItems.filter(i => i.checked).length === 0}
                >
                    {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save size={18} />}
                    Sync {scannedItems.filter(i => i.checked).length} items
                </button>
            </div>
        </div>
      );
  }

  // --- RENDER CAMERA ---
  return (
    <div className={`relative h-screen w-screen overflow-hidden ${cameraActive ? 'bg-transparent' : 'bg-black'} transition-colors duration-700`}>
        <div id="cameraPreview" className="absolute inset-0 bg-transparent z-0" />
        
        <button 
            onClick={() => router.back()}
            className="absolute top-6 left-6 z-50 p-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 text-white active:scale-90 transition-all"
        >
            <ChevronLeft size={24} />
        </button>

        <HandOverlay status={analyzing ? 'scanning' : 'idle'} />
        {analyzing && <ScanningGrid />}

        <AnimatePresence>
            {analyzing && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center z-40 bg-black/60 backdrop-blur-sm"
                >
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative w-20 h-20">
                            <div className="absolute inset-0 border-4 border-white/20 rounded-full" />
                            <div className="absolute inset-0 border-4 border-t-white rounded-full animate-spin" />
                        </div>
                        <div className="text-center">
                            <span className="text-white font-black uppercase tracking-[0.3em] text-sm block">Neural Matrix</span>
                            <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest mt-2 block">Extracting Logistics...</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {errorMsg && (
             <motion.div initial={{ y: -100 }} animate={{ y: 0 }} className="absolute top-24 left-6 right-6 z-[70] bg-red-500/90 border border-white/20 p-4 rounded-2xl text-white backdrop-blur-xl shadow-2xl flex justify-between items-center">
                 <p className="font-bold text-xs">{errorMsg}</p>
                 <button onClick={() => setErrorMsg(null)} className="p-1">✕</button>
             </motion.div>
        )}

        <div className="absolute bottom-16 left-0 right-0 z-50 flex flex-col items-center gap-8 pb-safe">
            <div className="flex flex-col items-center gap-1">
                <span className="text-white font-black uppercase tracking-[0.4em] text-[10px] opacity-40">Capture Buffer</span>
                <div className="w-1 h-1 rounded-full bg-white/20" />
            </div>

            <button 
                onClick={handleCapture}
                disabled={analyzing}
                className="h-24 w-24 rounded-full border-[6px] border-white/20 bg-white/10 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all group"
            >
                <div className="h-16 w-16 rounded-full bg-white shadow-xl group-hover:scale-95 transition-transform" />
            </button>
        </div>
    </div>
  );
}
