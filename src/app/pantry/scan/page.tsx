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
  const [result, setResult] = useState<any>(null); // Legacy, kept for safe transition before removal

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
        category: item.name, // Simplified
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

      console.log('Batch saved:', inserts.length);
      stopCamera();
      router.push('/pantry');
    } catch (err) {
      console.error("Save failed:", err);
      setErrorMsg("Failed to save items. Please try again.");
      setIsSaving(false);
    }
  };

  // --- ITEM ACTIONS ---
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
        if (camera !== 'granted') {
            console.warn('Camera permission denied');
            return;
        }
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

  // --- CAPTURE & PROCESS ---
  const handleCapture = async () => {
    if (analyzing || isProcessing.current) return;
    isProcessing.current = true;
    setAnalyzing(true);
    setErrorMsg(null);
    setDebugLog(null);
    setShowResults(false);
    setResult(null);
    
    try {
      let base64Image = '';

      if (Capacitor.isNativePlatform()) {
        const result = await CameraPreview.capture({ quality: 85 });
        base64Image = result.value;
      } else {
        alert("Web Camera not implemented. Use Native Device or Debug Upload.");
        setAnalyzing(false);
        isProcessing.current = false;
        return;
      }

      await processImage(base64Image);

    } catch (err) {
      console.error(err);
      setErrorMsg('Capture failed.');
      setAnalyzing(false);
      isProcessing.current = false;
    }
  };

  const processImage = async (base64: string) => {
    try {
      stopCamera(); // Freeze preview implied

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Auth missing");

      if (isMounted.current) {
         setDebugLog({ status: "Preparing Upload...", mode: "pantry" });
      }

      // 0. Check Network
      if (!navigator.onLine) {
          throw new Error("No Internet Connection (Offline Mode not supported for Pantry yet)");
      }

      // CALL VISION PIPELINE (MODE = PANTRY)
      // 180s Timeout for consistency
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); 

      if (isMounted.current) {
         setDebugLog((prev: any) => ({ ...prev, status: "Sending Image to Cloud..." }));
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/vision-pipeline`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            'x-user-token': session.access_token
          },
          body: JSON.stringify({
            image: base64,
            mode: 'pantry', 
          }),
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);

      if (isMounted.current) {
         setDebugLog((prev: any) => ({ ...prev, status: "Response Received. Parsing..." }));
      }

      const textBody = await res.text();
      let data;
      try { data = JSON.parse(textBody); } catch { 
          data = { error: "Invalid JSON", raw: textBody.substring(0, 100) }; 
      }

      if (isMounted.current) setDebugLog(data);

      if (!res.ok) throw new Error(data.error || `Server Error: ${res.status}`);

      // Parse Result
      // Pantry mode returns somewhat similar structure but let's be safe
      // Parse Result -> Map to Draft Items
      const rawItems = data.pantry_items || []; 
      
      // Fallback for legacy single-item
      if (rawItems.length === 0 && data.items && data.items.length > 0) {
          rawItems.push({
              name: data.items[0],
              quantity: "Full",
              expiry: "",
              ingredients: data.ingredients || [] // Attach ingredients to primary
          });
      }

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

    } catch (err) {
       const msg = err instanceof Error ? err.message : String(err);
       console.error("Pantry Scan Error:", msg);
       if (isMounted.current) {
           setErrorMsg(msg);
           startCamera(); // Restart on error
       }
    } finally {
       if (isMounted.current) setAnalyzing(false);
       isProcessing.current = false;
    }
  };

  // Fallback for web testing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      setAnalyzing(true);
      processImage(base64);
    };
    reader.readAsDataURL(file);
  };

  // --- RENDER RESULTS (LIST VIEW) ---
  if (showResults) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col p-4 animate-in fade-in duration-500 pb-safe">
            <h1 className="text-2xl font-bold text-white mb-4 mt-8">Review Items</h1>
            
            <div className="flex-1 overflow-y-auto space-y-3 pb-24">
                {scannedItems.map((item) => (
                    <div key={item.id} className={`p-4 rounded-xl border transition-all ${item.checked ? 'bg-white/10 border-blue-500/50' : 'bg-white/5 border-white/5 opacity-60'}`}>
                        <div className="flex items-start gap-3">
                            <div 
                                onClick={() => toggleItem(item.id)}
                                className={`h-6 w-6 rounded-full border flex items-center justify-center mt-1 cursor-pointer ${item.checked ? 'bg-blue-500 border-blue-500' : 'border-zinc-500'}`}
                            >
                                {item.checked && <Check className="h-4 w-4 text-white" />}
                            </div>
                            
                            <div className="flex-1 space-y-2">
                                <Input 
                                    value={item.name} 
                                    onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                    className="bg-transparent border-none text-lg font-bold p-0 h-auto focus-visible:ring-0 text-white placeholder:text-zinc-600"
                                    placeholder="Item Name"
                                />
                                <div className="flex gap-2">
                                    <Input 
                                        value={item.quantity}
                                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                        className="bg-white/5 border-white/10 h-8 text-xs w-24 text-zinc-300"
                                        placeholder="Qty"
                                    />
                                    <Input 
                                        value={item.expiry || ''}
                                        onChange={(e) => updateItem(item.id, 'expiry', e.target.value)}
                                        className="bg-white/5 border-white/10 h-8 text-xs w-28 text-zinc-300"
                                        placeholder="Expiry"
                                    />
                                </div>
                                {item.ingredients && item.ingredients.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        <div className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-400">
                                            {item.ingredients.length} Ingredients Found
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button variant="ghost" className="text-zinc-500 hover:text-red-400 p-2 h-8 w-8" onClick={() => deleteItem(item.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}

                <Button variant="outline" onClick={addItem} className="w-full border-dashed border-white/20 bg-transparent text-zinc-400 hover:bg-white/5 hover:text-white">
                    <Plus className="h-4 w-4 mr-2" /> Add Missing Item
                </Button>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/80 backdrop-blur-lg border-t border-white/10 flex gap-3 pb-safe">
                <Button 
                    variant="outline" 
                    className="flex-1 h-12 rounded-xl border-white/10 bg-white/5 text-white"
                    onClick={() => { setShowResults(false); startCamera(); }}
                >
                    Retake
                </Button>
                <Button 
                    className="flex-[2] h-12 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold"
                    onClick={handleSaveBatch}
                    disabled={isSaving || scannedItems.filter(i => i.checked).length === 0}
                >
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save {scannedItems.filter(i => i.checked).length} Items
                </Button>
            </div>
        </div>
      );
  }


  // --- RENDER CAMERA ---
  return (
    <div className={`relative h-screen w-screen overflow-hidden ${cameraActive ? 'bg-transparent' : 'bg-black'}`}>
        <div id="cameraPreview" className="absolute inset-0 bg-transparent z-0" />
        
        {/* Navigation */}
        <button 
            onClick={() => router.back()}
            className="absolute top-6 left-6 z-50 p-3 rounded-full bg-black/40 backdrop-blur border border-white/10 text-white"
        >
            <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Overlays */}
        <HandOverlay status={analyzing ? 'scanning' : 'idle'} />
        {analyzing && <ScanningGrid />}

        {/* Loading State */}
        {analyzing && (
            <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/40 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />
                    <span className="text-blue-200 font-medium tracking-wide">Multi-Item Scan...</span>
                </div>
            </div>
        )}

        {/* Debug Console */}
        {showDebug && (
            <div className="absolute top-24 left-4 right-4 z-[60] bg-black/90 p-4 rounded-xl border border-white/20 max-h-[40vh] overflow-auto text-[10px] font-mono text-zinc-300">
                 <pre>{JSON.stringify(debugLog || { status: 'Ready' }, null, 2)}</pre>
            </div>
        )}

        {/* Error */}
        {errorMsg && (
             <div className="absolute top-24 left-4 right-4 z-[70] bg-red-500/20 border border-red-500/50 p-4 rounded-xl text-red-200 backdrop-blur-md">
                 <p className="font-bold mb-1">Error</p>
                 <p className="text-xs">{errorMsg}</p>
                 <button onClick={() => setErrorMsg(null)} className="absolute top-2 right-2 p-1 opacity-50">✕</button>
             </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-12 left-0 right-0 z-50 flex flex-col items-center justify-end gap-6 pb-safe">
            <button 
                onClick={() => setShowDebug(!showDebug)} 
                className="text-white/30 text-[10px] uppercase tracking-widest font-bold"
            >
                {showDebug ? 'Hide Debug' : 'Show Debug'}
            </button>

            <button 
                onClick={handleCapture}
                disabled={analyzing}
                className="h-20 w-20 rounded-full border-[4px] border-white/20 bg-white shadow-xl flex items-center justify-center active:scale-95 transition-all"
            >
                <div className="h-16 w-16 rounded-full border border-gray-300" />
            </button>
            
            {/* Web Upload Debug */}
            {!Capacitor.isNativePlatform() && (
                 <label className="text-xs text-white/50 cursor-pointer bg-white/10 px-3 py-1 rounded">
                     Web Upload (Debug)
                     <input type="file" className="hidden" onChange={handleFileUpload} />
                 </label>
            )}
        </div>
    </div>
  );
}
