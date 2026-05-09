'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { createClient } from '@/lib/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { visionService } from '@/lib/services/vision.service';
import { Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { NeuralScanOverlay } from './NeuralScanOverlay';
import { MetabolicBadge } from '../ui/MetabolicBadge';
import { SafetyAlert } from '../ui/SafetyAlert';
import { motion, AnimatePresence } from 'framer-motion';
import { buildLogMetadata } from '@/lib/utils/metabolic.utils';
import { normalizeError } from '@/lib/utils/errors';
import type { ScanResult } from '@/lib/types/metabolic';
import { set, get, del } from 'idb-keyval';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { VISION_CONFIG } from '@/lib/vision/vision.config';

export function OptimisticCapture({
  onCapture,
}: {
  // onCapture is now optional/fallback, we handle upload internally here
  onCapture?: (blob: Blob) => Promise<any>;
}) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'complete'>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { user } = useDashboardData();

  const uploadMutation = useMutation({
    mutationFn: async ({ userId, blob }: { userId: string, blob: Blob }) => {
      console.log("[Capture] Starting upload for user:", userId);
      
      const handWidth = user?.hand_width_mm;
      
      const { path } = await visionService.uploadScan(userId, blob);
      console.log("[Capture] Image uploaded to:", path);

      console.log("[Capture] Invoking vision-pipeline. Calibration:", handWidth || 'FALLBACK');
      const { data, error } = await supabase.functions.invoke('vision-pipeline', {
        body: { 
          imagePath: path,
          mode: VISION_CONFIG.modes.ANALYZE,
          hand_width_mm: handWidth || VISION_CONFIG.fallbacks.HAND_WIDTH_MM,
          is_calibrated: !!handWidth
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

    if (status === 'idle') startCamera();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [status]);

  // Offline Sync Listener
  useEffect(() => {
    const handleOnline = async () => {
      try {
        const pending = await get('pending_capture');
        if (pending && pending.blob && pending.userId) {
          toast.info("Network restored. Syncing offline capture...");
          setStatus('uploading');
          await uploadMutation.mutateAsync({ userId: pending.userId, blob: pending.blob });
          await del('pending_capture');
          toast.success("Offline capture synced successfully!");
        }
      } catch (err) {
        console.error("Failed to sync offline capture:", err);
      }
    };

    window.addEventListener('online', handleOnline);
    // Check on mount in case they came online between sessions
    if (navigator.onLine) handleOnline();

    return () => window.removeEventListener('online', handleOnline);
  }, [uploadMutation]);

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
        await set('pending_capture', { blob, userId: authUser.id, timestamp: Date.now() });
        toast.success("Saved locally. Will analyze when online.");
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

  const handleLog = async () => {
    if (!scanResult || isLogging) return;
    setIsLogging(true);
    
    try {
        if (scanResult.persisted) {
            console.log("[Capture] Result already persisted by server.");
        } else {
            console.log("[Capture] Manually logging meal result (Server Persistence Skipped)...");
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) throw new Error("No user found");

            const logEntry = {
                user_id: authUser.id,
                grams: scanResult.volume_cm3 || 0,
                metabolic_tags_json: buildLogMetadata(scanResult),
                captured_at: new Date().toISOString()
            };

            const { error } = await supabase.from('logs').insert(logEntry);
            if (error) throw error;
        }

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

  if (status === 'complete') {
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

        {scanResult && (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                {/* Safety Alerts at the top */}
                {scanResult.safety_alerts?.map((alert: any, idx: number) => (
                    <div key={idx} className="flex justify-center">
                        <SafetyAlert reason={alert.reason} type={alert.type} />
                    </div>
                ))}

                {/* Main Insight Card */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-8 shadow-sm space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-4">
                            <h3 className="text-2xl font-black text-[var(--text-primary)] capitalize truncate">{scanResult.items?.[0]?.name || 'Analyzed Content'}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-widest">{scanResult.macros?.calories || 0} kcal</span>
                                <div className="w-1 h-1 bg-[var(--border)] rounded-full" />
                                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{scanResult.items?.[0]?.quantity}</span>
                            </div>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shrink-0">
                            <Sparkles size={24} />
                        </div>
                    </div>

                    <div className="bg-[var(--bg-app)] border border-[var(--border)] p-6 rounded-3xl">
                        <p className="text-sm text-[var(--text-primary)] font-medium leading-relaxed italic opacity-80">
                            "{scanResult.metabolic_insight?.layman_explanation || "Meal signal successfully integrated into your metabolic history."}"
                        </p>
                    </div>

                    {/* Triggered Phenomena Badges */}
                    <div className="flex flex-wrap gap-2">
                        {scanResult.metabolic_insight?.triggered_phenomena?.map((p: any) => (
                            <MetabolicBadge key={p.id} name={p.name} why={p.why} />
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Protein', val: scanResult.macros?.protein, unit: 'g' },
                        { label: 'Carbs', val: scanResult.macros?.carbs, unit: 'g' },
                        { label: 'Fats', val: scanResult.macros?.fat, unit: 'g' },
                    ].map(m => (
                        <div key={m.label} className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 rounded-3xl text-center shadow-sm">
                            <div className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-widest mb-1 opacity-50">{m.label}</div>
                            <div className="text-lg font-black text-[var(--text-primary)]">{Math.round(m.val || 0)}<span className="text-[10px] opacity-30 ml-0.5">{m.unit}</span></div>
                        </div>
                    ))}
                </div>

                {/* Extended Macros */}
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { label: 'Fiber', val: scanResult.macros?.fiber, unit: 'g' },
                        { label: 'Sugar', val: scanResult.macros?.sugar, unit: 'g' },
                        { label: 'Sodium', val: scanResult.macros?.sodium, unit: 'mg' },
                        { label: 'Chol.', val: scanResult.macros?.cholesterol, unit: 'mg' },
                    ].map(m => (
                        <div key={m.label} className="bg-[var(--bg-surface)] border border-[var(--border)] p-3 rounded-2xl text-center">
                            <div className="text-[8px] font-black uppercase text-[var(--text-secondary)] tracking-widest mb-0.5 opacity-40">{m.label}</div>
                            <div className="text-sm font-bold text-[var(--text-primary)]">{Math.round(m.val || 0)}<span className="text-[8px] opacity-30 ml-0.5">{m.unit}</span></div>
                        </div>
                    ))}
                </div>

                {/* Molecular Scaffolding */}
                {scanResult.ingredients?.length > 0 && (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-6 shadow-sm">
                        <h4 className="text-[9px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-4">Molecular Scaffolding</h4>
                        <div className="space-y-3">
                            {scanResult.ingredients.map((ing: any, i: number) => {
                                const ingName = ing.name || ing;
                                const ratio = ing.ratio != null ? `${Math.round(ing.ratio * 100)}%` : null;
                                return (
                                    <div key={i} className="flex justify-between items-center">
                                        <span className="text-sm text-[var(--text-primary)] font-medium capitalize">{ingName}</span>
                                        {ratio && <span className="text-sm text-[var(--text-secondary)] font-bold tabular-nums">{ratio}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Vitamins */}
                {scanResult.vitamins?.length > 0 && (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-6 shadow-sm">
                        <h4 className="text-[9px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-4">Vitamins</h4>
                        <div className="space-y-3">
                            {scanResult.vitamins.map((v: any, i: number) => (
                                <div key={i} className="flex justify-between items-center">
                                    <span className="text-sm text-[var(--text-primary)] font-medium">{v.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-[var(--text-secondary)] tabular-nums">{v.amount}</span>
                                        {v.daily_value_pct != null && (
                                            <span className="text-[10px] font-bold text-[var(--primary)] tabular-nums">{v.daily_value_pct}% DV</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Minerals */}
                {scanResult.minerals?.length > 0 && (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-6 shadow-sm">
                        <h4 className="text-[9px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-4">Minerals</h4>
                        <div className="space-y-3">
                            {scanResult.minerals.map((m: any, i: number) => (
                                <div key={i} className="flex justify-between items-center">
                                    <span className="text-sm text-[var(--text-primary)] font-medium">{m.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-[var(--text-secondary)] tabular-nums">{m.amount}</span>
                                        {m.daily_value_pct != null && (
                                            <span className="text-[10px] font-bold text-[var(--primary)] tabular-nums">{m.daily_value_pct}% DV</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Other Nutrients (legacy micros) */}
                {scanResult.micros?.length > 0 && (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-6 shadow-sm">
                        <h4 className="text-[9px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-4">Other Nutrients</h4>
                        <div className="space-y-3">
                            {scanResult.micros.map((micro: any, i: number) => (
                                <div key={i} className="flex justify-between items-center">
                                    <span className="text-sm text-[var(--text-primary)] font-medium">{micro.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-[var(--text-secondary)] tabular-nums">{micro.amount}</span>
                                        {micro.daily_value_pct != null && (
                                            <span className="text-[10px] font-bold text-[var(--primary)] tabular-nums">{micro.daily_value_pct}% DV</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </motion.div>
        )}
        </div>

        {/* Sticky Bottom Action Buttons */}
        <div className="shrink-0 p-6 pt-3 pb-safe bg-[var(--bg-app)] border-t border-[var(--border)]">
            <button 
                onClick={handleLog}
                disabled={isLogging || !scanResult}
                className="w-full h-16 bg-emerald-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
            >
                {isLogging ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> Add to Daily Log</>}
            </button>

            <button 
                onClick={() => router.push('/dashboard')}
                className="w-full h-12 bg-transparent text-[var(--text-secondary)] rounded-[2rem] font-bold uppercase tracking-widest text-[9px] mt-2 opacity-50"
            >
                Return to Hub
            </button>
        </div>
      </div>
    );
  }

  const isScanning = (status as string) === 'uploading';
  const showOverlay = (status as string) !== 'complete';

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
      <NeuralScanOverlay status={isScanning ? 'scanning' : 'idle'} show={showOverlay} />

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
