'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { createClient } from '@/lib/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { visionService } from '@/lib/services/vision.service';
import { Sparkles, CheckCircle2, Loader2, Minus, Plus, X, Layers, Microscope, Activity, ChevronRight, Info } from 'lucide-react';
import { toast } from 'sonner';
import { NeuralScanOverlay } from './NeuralScanOverlay';
import { HandOverlay } from './HandOverlay';
import { MetabolicBadge } from '../ui/MetabolicBadge';
import { SafetyAlert } from '../ui/SafetyAlert';
import { motion, AnimatePresence } from 'framer-motion';
import { buildLogMetadata } from '@/lib/utils/metabolic.utils';
import { normalizeError } from '@/lib/utils/errors';
import type { ScanResult } from '@/lib/types/metabolic';
import { set, get, del } from 'idb-keyval';
import { useUser } from '@/lib/hooks/useUser';
import { VISION_CONFIG } from '@/lib/vision/vision.config';

export function OptimisticCapture({
  onCapture,
}: {
  // onCapture is now optional/fallback, we handle upload internally here
  onCapture?: (blob: Blob) => Promise<any>;
}) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'complete' | 'low_confidence'>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [lowConfidenceData, setLowConfidenceData] = useState<{ result: ScanResult; confidence: number } | null>(null);
  const [editableResult, setEditableResult] = useState<ScanResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { user } = useUser();

  const uploadMutation = useMutation({
    mutationFn: async ({ userId, blob }: { userId: string, blob: Blob }) => {
      console.log("[Capture] Starting upload for user:", userId);
      
      const handWidth = user?.hand_width_mm;
      
      const { path } = await visionService.uploadScan(userId, blob);
      console.log("[Capture] Image uploaded to:", path);

      console.log("[Capture] Invoking vision-pipeline. Calibration:", handWidth || 'FALLBACK');
      const clientLocalDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in device timezone
      const timezoneOffset = new Date().getTimezoneOffset(); // minutes offset from UTC
      const { data, error } = await supabase.functions.invoke('vision-pipeline', {
        body: { 
          imagePath: path,
          mode: VISION_CONFIG.modes.ANALYZE,
          hand_width_mm: handWidth || VISION_CONFIG.fallbacks.HAND_WIDTH_MM,
          is_calibrated: !!handWidth,
          local_date: clientLocalDate,
          timezone_offset: timezoneOffset
        }
      });

      if (error) {
        console.error("[Capture] Neural Pipeline Error:", error);
        throw new Error(error.message || "Failed to process image");
      }
      console.log("[Capture] Neural Pipeline Success:", data);
      return { ...data, imagePath: path };
    },
    onSuccess: (data) => {
      // Gap 4: Check confidence for REQUEST_ANGLE_SHIFT
      const confidence = data.analysis_confidence ?? 1;
      if (confidence < 0.5) {
        console.warn(`[Capture] Low confidence (${confidence}). Prompting re-capture.`);
        setLowConfidenceData({ result: data, confidence });
        setStatus('low_confidence');
        return;
      }
      setScanResult(data);
      setStatus('complete');
    },
    onError: (error: any) => {
      console.error('Upload Process Failed:', error);
      setStatus('idle');
      const msg = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      toast.error('Scan Failed: ' + msg);
    }
  });

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'environment',
              width: { ideal: 1080 },
              height: { ideal: 1920 } 
            },
            audio: false,
          });
          if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera Stream Error:", err);
        alert('Camera access denied. Please enable permissions.');
      }
    }

    if (status === 'idle' || status === 'low_confidence') startCamera();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [status]);

  // Offline Sync Listener
  useEffect(() => {
    const handleOnline = async () => {
      try {
        let queue = await get('pending_captures_queue') || [];
        const legacyPending = await get('pending_capture');

        // Migrate legacy single pending_capture to the queue
        if (legacyPending && legacyPending.blob && legacyPending.userId) {
          queue = [{
            id: 'legacy-migration',
            blob: legacyPending.blob,
            userId: legacyPending.userId,
            timestamp: legacyPending.timestamp || Date.now()
          }, ...queue];
          await set('pending_captures_queue', queue);
          await del('pending_capture');
        }

        if (queue.length > 0) {
          toast.info(`Network restored. Syncing ${queue.length} offline capture(s)...`);
          setStatus('uploading');
          
          while (queue.length > 0) {
            const item = queue[0];
            await uploadMutation.mutateAsync({ userId: item.userId, blob: item.blob });
            // Remove from the queue in storage
            queue.shift();
            await set('pending_captures_queue', queue);
          }
          
          toast.success("All offline captures synced successfully!");
          setStatus('idle');
          // Invalidate daily logs query to refresh dashboard
          queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
        }
      } catch (err) {
        console.error("Failed to sync offline captures:", err);
        toast.error("Offline sync encountered an error. Remaining items queued.");
        setStatus('idle');
      }
    };

    window.addEventListener('online', handleOnline);
    // Check on mount in case they came online between sessions
    if (navigator.onLine) handleOnline();

    return () => window.removeEventListener('online', handleOnline);
  }, [uploadMutation, queryClient]);

  const handleClick = async () => {
    if (!videoRef.current || status !== 'idle') return;

    setStatus('uploading');

    try {
      const canvas = document.createElement('canvas');
      const MAX_DIMENSION = VISION_CONFIG.image.MAX_DIMENSION;
      let width = videoRef.current.videoWidth;
      let height = videoRef.current.videoHeight;
      
      if (width > height) {
        if (width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        }
      } else {
        if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', VISION_CONFIG.image.QUALITY)
      );
      if (!blob) throw new Error('Could not capture frame');

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('No authenticated user session');

      if (!navigator.onLine) {
        const queue = await get('pending_captures_queue') || [];
        const newId = crypto.randomUUID();
        queue.push({ id: newId, blob, userId: authUser.id, timestamp: Date.now() });
        await set('pending_captures_queue', queue);
        toast.success(`Saved locally (${queue.length} items queued). Will analyze when online.`);
        setStatus('idle');
        return;
      }

      await uploadMutation.mutateAsync({ userId: authUser.id, blob });

      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNative;
      if (isNative) {
        await LocalNotifications.requestPermissions();
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 2147483647),
              title: 'Neural Analysis Started',
              body: 'Extracting metabolic signatures from your meal.',
              schedule: { at: new Date(Date.now() + 1000) },
              smallIcon: "ic_stat_icon_config_sample"
            },
          ],
        });
      }
    } catch (e: any) {
      console.error('Capture Sequence Error:', e);
      toast.error(e.message || "Capture Failed");
      setStatus('idle');
    }
  };

  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    if (scanResult) {
      const itemsWithMultiplier = scanResult.items.map(item => ({
        ...item,
        multiplier: item.multiplier ?? 1
      }));
      setEditableResult({ ...scanResult, items: itemsWithMultiplier });
    }
  }, [scanResult]);

  const recalculateTotals = (items: any[]) => {
    if (!editableResult) return;

    // 1. Recalculate Macros
    const newMacros = items.reduce((acc, item) => {
      const m = item.multiplier || 1;
      return {
        calories: acc.calories + ((item.calories || 0) * m),
        protein: acc.protein + ((item.protein || 0) * m),
        carbs: acc.carbs + ((item.carbs || 0) * m),
        fat: acc.fat + ((item.fat || 0) * m),
        fiber: acc.fiber + ((item.fiber || 0) * m),
        sugar: acc.sugar + ((item.sugar || 0) * m),
        sodium: acc.sodium + ((item.sodium || 0) * m),
        cholesterol: acc.cholesterol + ((item.cholesterol || 0) * m),
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 });

    // 2. Synchronize Ingredients & Volumetric Data
    // We filter ingredients based on items remaining and adjust volume
    const remainingNames = items.map(it => it.name.toLowerCase());
    const newIngredients = (scanResult?.ingredients || []).filter(ing => {
        const name = (typeof ing === 'string' ? ing : ing.name) || "";
        const lowerName = name.toLowerCase();
        // If an ingredient is explicitly named after a food item we removed, purge it
        return remainingNames.some(itName => itName.includes(lowerName) || lowerName.includes(itName));
    });

    // 3. Update Volume based on total quantity change
    const originalCount = scanResult?.items?.length || 1;
    const currentCount = items.reduce((acc, it) => acc + (it.multiplier || 1), 0);
    const volumeFactor = currentCount / originalCount;
    const newVolume = (scanResult?.volume_cm3 || 0) * volumeFactor;

    setEditableResult({
      ...editableResult,
      items,
      macros: newMacros,
      ingredients: newIngredients,
      volume_cm3: newVolume
    });
  };

  const handleUpdateMultiplier = (index: number, delta: number) => {
    if (!editableResult) return;
    const newItems = [...editableResult.items];
    newItems[index] = {
      ...newItems[index],
      multiplier: Math.max(0, (newItems[index].multiplier || 1) + delta)
    };
    recalculateTotals(newItems);
  };

  const handleRemoveItem = (index: number) => {
    if (!editableResult) return;
    const newItems = editableResult.items.filter((_, i) => i !== index);
    recalculateTotals(newItems);
  };

  const handleLog = async () => {
    const resultToLog = editableResult || scanResult;
    if (!resultToLog || isLogging) return;
    setIsLogging(true);
    
    try {
        // Fix 1: Check if the edge function already persisted this scan
        if (resultToLog.persisted) {
            console.log("[Capture] Edge function already persisted this scan — skipping client-side insert.");
            toast.success("Meal logged successfully!");
            queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
            router.push('/dashboard');
            return;
        }

        console.log("[Capture] Manually logging meal result...");
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error("No user found");

        const clientLocalDate = new Date().toLocaleDateString('en-CA');
        const logEntry = {
            user_id: authUser.id,
            grams: resultToLog.volume_cm3 || 0,
            local_date: clientLocalDate,
            metabolic_tags_json: buildLogMetadata(resultToLog),
            captured_at: new Date().toISOString()
        };

        const { error } = await supabase.from('logs').insert(logEntry);
        if (error) throw error;

        toast.success("Meal logged successfully!");
        queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
        router.push('/dashboard');
    } catch (e: unknown) {
        const otekaErr = normalizeError(e);
        console.error("[Capture] Log Failed:", otekaErr);
        toast.error(otekaErr.userMessage);
    } finally {
        setIsLogging(false);
    }
  };

  if (status === 'uploading') {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-xl transition-all duration-300">
        <div className="w-72 p-10 rounded-[3rem] bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl flex flex-col items-center gap-8 animate-in zoom-in-95 duration-300">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-[4px] border-[var(--primary)]/10"></div>
            <div className="absolute inset-0 rounded-full border-[4px] border-[var(--primary)] border-t-transparent animate-spin"></div>
            <Sparkles className="h-10 w-10 text-[var(--primary)] animate-pulse" />
          </div>
          <div className="space-y-2 text-center">
            <h3 className="text-xl font-black uppercase tracking-tight text-[var(--text-primary)]">Syncing Core</h3>
            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-[0.2em]">Neural Pipeline Active</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'complete' && editableResult) {
    return (
      <div className="fixed inset-0 bg-[var(--bg-app)] flex flex-col animate-in fade-in duration-500 transition-colors z-[60]">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-4">
          <div className="text-center space-y-4 mb-8 pt-safe">
            <div className="bg-emerald-500/10 p-6 rounded-[2.5rem] inline-block backdrop-blur-xl border border-emerald-500/20">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-4xl font-black tracking-tight uppercase italic text-[var(--text-primary)]">Synced</h2>
              <p className="text-[var(--text-secondary)] font-bold uppercase tracking-widest text-[10px] opacity-40">Metabolic Pattern Anchored</p>
            </div>
          </div>

          <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
          >
              {/* Safety Alerts at the top */}
              {editableResult.safety_alerts?.map((alert: any, idx: number) => (
                  <div key={idx} className="flex justify-center">
                      <SafetyAlert reason={alert.reason} type={alert.type} />
                  </div>
              ))}

              {/* Main Insight Card */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-8 shadow-sm space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Activity size={120} />
                  </div>
                  
                  <div className="flex justify-between items-start relative z-10">
                      <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--primary)] px-2 py-0.5 rounded-lg bg-[var(--primary)]/10">Neural Intelligence</span>
                          </div>
                          <h3 className="text-2xl font-black text-[var(--text-primary)] capitalize truncate leading-tight">
                            {editableResult.items?.[0]?.name || 'Analyzed Content'}
                          </h3>
                          <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1 text-[var(--primary)]">
                                <Activity size={12} fill="currentColor" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{Math.round(editableResult.macros?.calories || 0)} kcal</span>
                              </div>
                              <div className="w-1 h-1 bg-[var(--border)] rounded-full opacity-30" />
                              <div className="flex items-center gap-1 text-[var(--text-secondary)]">
                                <Layers size={12} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{editableResult.items?.length} components</span>
                              </div>
                          </div>
                      </div>
                      <div className="h-14 w-14 rounded-[20px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/60 text-white flex items-center justify-center shadow-lg shadow-[var(--primary)]/20 shrink-0">
                          <Sparkles size={28} />
                      </div>
                  </div>

                  <div className="bg-[var(--bg-app)] border border-[var(--border)] p-6 rounded-[2rem] relative group">
                      <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Info size={16} />
                      </div>
                      <p className="text-sm text-[var(--text-primary)] font-medium leading-relaxed italic opacity-80 pr-4">
                          "{editableResult.metabolic_insight?.layman_explanation || "Meal signal successfully integrated into your metabolic history."}"
                      </p>
                  </div>

                  {/* Triggered Phenomena Badges */}
                  <div className="flex flex-wrap gap-2">
                      {editableResult.metabolic_insight?.triggered_phenomena?.map((p: any) => (
                          <MetabolicBadge key={p.id} name={p.name} why={p.why} />
                      ))}
                  </div>
              </div>

              {/* Editable Items Section */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                        <Layers size={16} />
                    </div>
                    <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-[var(--text-primary)]">Molecular Components</h4>
                </div>
                
                <div className="space-y-3">
                  {editableResult.items.map((item: any, i: number) => (
                    <motion.div 
                        layout
                        key={i} 
                        className="flex items-center justify-between gap-4 p-4 bg-[var(--bg-app)]/50 rounded-[2rem] border border-[var(--border)] hover:bg-[var(--bg-app)] transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-[var(--text-primary)] block truncate group-hover:text-[var(--primary)] transition-colors">{item.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">{item.quantity}</span>
                            <div className="w-0.5 h-0.5 bg-[var(--border)] rounded-full" />
                            <span className="text-[9px] font-black text-[var(--primary)] opacity-60 uppercase tracking-widest">~{Math.round((item.calories || 0) * (item.multiplier || 1))} kcal</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-[var(--bg-surface)] rounded-[1.25rem] border border-[var(--border)] overflow-hidden shadow-sm">
                          <button 
                            onClick={() => handleUpdateMultiplier(i, -0.5)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[var(--text-secondary)]"
                          >
                            <Minus size={14} />
                          </button>
                          <div className="w-12 text-center">
                            <span className="text-xs font-black tabular-nums">{item.multiplier}x</span>
                          </div>
                          <button 
                            onClick={() => handleUpdateMultiplier(i, 0.5)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[var(--primary)]"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => handleRemoveItem(i)}
                          className="w-10 h-10 flex items-center justify-center text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {editableResult.items.length === 0 && (
                    <div className="text-center py-10 space-y-2 opacity-40">
                        <Layers size={32} className="mx-auto text-[var(--text-secondary)]" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">All components purged.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Macros Matrix */}
              <div className="grid grid-cols-3 gap-3">
                  {[
                      { label: 'Protein', val: editableResult.macros?.protein, unit: 'g', color: 'text-emerald-500' },
                      { label: 'Carbs', val: editableResult.macros?.carbs, unit: 'g', color: 'text-orange-500' },
                      { label: 'Fats', val: editableResult.macros?.fat, unit: 'g', color: 'text-rose-500' },
                  ].map(m => (
                      <div key={m.label} className="bg-[var(--bg-surface)] border border-[var(--border)] p-5 rounded-[2.5rem] text-center shadow-sm relative overflow-hidden group">
                          <div className={`absolute top-0 left-0 w-full h-1 bg-current ${m.color} opacity-20`} />
                          <div className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-[0.2em] mb-1.5 opacity-50">{m.label}</div>
                          <div className="text-2xl font-black text-[var(--text-primary)] tabular-nums">
                            {Math.round(m.val || 0)}
                            <span className="text-[10px] opacity-30 ml-0.5 font-bold uppercase">{m.unit}</span>
                          </div>
                      </div>
                  ))}
              </div>

              {/* Scientific Breakdown */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                        <Microscope size={16} />
                    </div>
                    <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-[var(--text-primary)]">Molecular Scaffolding</h4>
                </div>

                {/* Extended Macros Row */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Fiber', val: editableResult.macros?.fiber, unit: 'g' },
                        { label: 'Sugar', val: editableResult.macros?.sugar, unit: 'g' },
                        { label: 'Sodium', val: editableResult.macros?.sodium, unit: 'mg' },
                        { label: 'Chol.', val: editableResult.macros?.cholesterol, unit: 'mg' },
                    ].map(m => (
                        <div key={m.label} className="space-y-1">
                            <div className="text-[8px] font-black uppercase text-[var(--text-secondary)] tracking-widest opacity-40">{m.label}</div>
                            <div className="text-sm font-black text-[var(--text-primary)] tabular-nums">
                                {Math.round(m.val || 0)}
                                <span className="text-[8px] opacity-30 ml-0.5 uppercase font-bold">{m.unit}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Ingredients List */}
                {editableResult.ingredients?.length > 0 && (
                    <div className="space-y-4 pt-6 border-t border-[var(--border)]">
                        {editableResult.ingredients.map((ing: any, i: number) => {
                            const ingName = ing.name || ing;
                            const ratio = ing.ratio != null ? `${Math.round(ing.ratio * 100)}%` : null;
                            return (
                                <div key={i} className="flex justify-between items-center group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] opacity-40 group-hover:scale-150 transition-transform" />
                                        <span className="text-sm text-[var(--text-primary)] font-bold capitalize group-hover:text-[var(--primary)] transition-colors">{ingName}</span>
                                    </div>
                                    {ratio && <span className="text-xs text-[var(--text-secondary)] font-black tabular-nums bg-[var(--bg-app)] px-3 py-1 rounded-full border border-[var(--border)]">{ratio}</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
              </div>

              {/* Micronutrient Matrix */}
              {(editableResult.vitamins?.length > 0 || editableResult.minerals?.length > 0) && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-8 shadow-sm">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                            <Sparkles size={16} />
                        </div>
                        <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-[var(--text-primary)]">Micronutrient Matrix</h4>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* Vitamins */}
                        {editableResult.vitamins?.length > 0 && (
                            <div className="space-y-4">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-40 block mb-4">Core Vitamins</span>
                                {editableResult.vitamins.map((v: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center bg-[var(--bg-app)]/50 p-3 rounded-2xl border border-[var(--border)]">
                                        <span className="text-sm text-[var(--text-primary)] font-bold">{v.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-[var(--text-secondary)] font-black tabular-nums">{v.amount}</span>
                                            {v.daily_value_pct != null && (
                                                <div className="px-3 py-1 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20">
                                                    <span className="text-[10px] font-black text-[var(--primary)] tabular-nums">{v.daily_value_pct}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Minerals */}
                        {editableResult.minerals?.length > 0 && (
                            <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-40 block mb-4">Essential Minerals</span>
                                {editableResult.minerals.map((m: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center bg-[var(--bg-app)]/50 p-3 rounded-2xl border border-[var(--border)]">
                                        <span className="text-sm text-[var(--text-primary)] font-bold">{m.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-[var(--text-secondary)] font-black tabular-nums">{m.amount}</span>
                                            {m.daily_value_pct != null && (
                                                <div className="px-3 py-1 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20">
                                                    <span className="text-[10px] font-black text-[var(--primary)] tabular-nums">{m.daily_value_pct}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
              )}

          </motion.div>
        </div>

        {/* Sticky Bottom Action Buttons */}
        <div className="shrink-0 p-8 pt-4 pb-safe bg-[var(--bg-app)] border-t border-[var(--border)]">
            <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLog}
                disabled={isLogging || editableResult.items.length === 0}
                className="w-full h-16 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale"
            >
                {isLogging ? (
                    <Loader2 className="animate-spin" size={20} />
                ) : (
                    <>
                        <CheckCircle2 size={20} strokeWidth={3} />
                        Synchronize Entry
                    </>
                )}
            </motion.button>

            <button 
                onClick={() => router.push('/dashboard')}
                className="w-full h-12 bg-transparent text-[var(--text-secondary)] rounded-[2rem] font-black uppercase tracking-[0.2em] text-[8px] mt-2 opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
            >
                Cancel Acquisition
                <ChevronRight size={14} />
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="absolute inset-0 w-full h-full object-cover opacity-60" 
      />
      
      {/* High-Fidelity Design System Overlay */}
      <NeuralScanOverlay status="idle" show={true} />
      
      {/* Gap 2: AR Hand Overlay for calibration reference */}
      <HandOverlay 
        status={status === 'complete' ? 'locked' : 'idle'} 
        show={status === 'idle' || status === 'low_confidence'}
      />

      {/* Gap 4: Low Confidence Re-capture Prompt (REQUEST_ANGLE_SHIFT) */}
      {status === 'low_confidence' && lowConfidenceData && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-80 p-8 rounded-[3rem] bg-[var(--bg-surface)] border border-amber-500/30 shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center border-2 border-amber-500/30">
              <Sparkles className="h-8 w-8 text-amber-500" />
            </div>
            <div className="space-y-2 text-center">
              <h3 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">Low Confidence</h3>
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-[0.2em]">Confidence: {Math.round(lowConfidenceData.confidence * 100)}%</p>
              <p className="text-xs text-[var(--text-secondary)] mt-2">Try a different angle or better lighting for more accurate results.</p>
            </div>
            <div className="w-full space-y-3">
              <button
                onClick={() => {
                  setLowConfidenceData(null);
                  setStatus('idle');
                }}
                className="w-full h-14 rounded-2xl bg-[var(--primary)] text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg active:scale-95 transition-transform"
              >
                Retake Photo
              </button>
              <button
                onClick={() => {
                  setScanResult(lowConfidenceData.result);
                  setLowConfidenceData(null);
                  setStatus('complete');
                }}
                className="w-full h-12 rounded-2xl border border-[var(--border)] text-[var(--text-secondary)] font-bold uppercase tracking-[0.15em] text-[9px] hover:bg-[var(--bg-surface-2)] transition-colors"
              >
                Use Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-20 left-0 right-0 flex flex-col items-center gap-10 z-50 pb-safe">
        <div className="text-center space-y-2">
            <p className="text-white/40 font-black uppercase tracking-[0.4em] text-[8px]">Target Lock Required</p>
            <div className="w-1 h-1 bg-[var(--primary)] rounded-full mx-auto animate-ping" />
        </div>

        <button
          onClick={handleClick}
          disabled={status !== 'idle'}
          className="w-24 h-24 rounded-full border-[8px] border-white/20 bg-white/10 backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform group"
          aria-label="Capture Photo"
        >
            <div className="w-16 h-16 rounded-full bg-white shadow-2xl group-hover:scale-95 transition-transform" />
        </button>
      </div>
    </div>
  );
}
