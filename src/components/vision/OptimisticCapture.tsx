'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { createClient } from '@/lib/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { visionService } from '@/lib/services/vision.service';
import { Sparkles, CheckCircle2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { NeuralScanOverlay } from './NeuralScanOverlay';
import { MetabolicBadge } from '../ui/MetabolicBadge';
import { SafetyAlert } from '../ui/SafetyAlert';
import { motion, AnimatePresence } from 'framer-motion';


export function OptimisticCapture({
  onCapture,
}: {
  // onCapture is now optional/fallback, we handle upload internally here
  onCapture?: (blob: Blob) => Promise<any>;
}) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'complete'>('idle');
  const [scanResult, setScanResult] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ userId, blob }: { userId: string, blob: Blob }) => {
      const { path } = await visionService.uploadScan(userId, blob);

      const { data, error } = await supabase.functions.invoke('vision-pipeline', {
        body: { 
          imagePath: path,
          mode: 'log'
        }
      });

      if (error) {
        console.error("Neural Pipeline Error:", error);
        throw new Error(error.message || "Failed to process image");
      }
      return data;
    },
    onSuccess: (data) => {
      setScanResult(data);
      setStatus('complete');
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
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

  const handleClick = async () => {
    if (!videoRef.current || status !== 'idle') return;

    setStatus('uploading');

    try {
      const canvas = document.createElement('canvas');
      const MAX_DIMENSION = 1024;
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
        canvas.toBlob(resolve, 'image/jpeg', 0.8)
      );
      if (!blob) throw new Error('Could not capture frame');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user session');

      await uploadMutation.mutateAsync({ userId: user.id, blob });

      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNative;
      if (isNative) {
        await LocalNotifications.requestPermissions();
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
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
      <div className="fixed inset-0 bg-[var(--bg-app)] flex flex-col p-6 animate-in fade-in duration-500 overflow-y-auto pb-safe transition-colors">
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
                        { label: 'Fats', val: scanResult.macros?.fat || scanResult.macros?.fats, unit: 'g' },
                    ].map(m => (
                        <div key={m.label} className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 rounded-3xl text-center shadow-sm">
                            <div className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-widest mb-1 opacity-50">{m.label}</div>
                            <div className="text-lg font-black text-[var(--text-primary)]">{Math.round(m.val || 0)}<span className="text-[10px] opacity-30 ml-0.5">{m.unit}</span></div>
                        </div>
                    ))}
                </div>

                <button 
                    onClick={() => router.push('/dashboard')}
                    className="w-full h-16 bg-[var(--primary)] text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all mt-4"
                >
                    Return to Hub
                </button>
            </motion.div>
        )}
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
      <NeuralScanOverlay status={status === 'idle' ? 'idle' : 'scanning'} />

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
