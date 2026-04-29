'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { createClient } from '@/lib/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { visionService } from '@/lib/services/vision.service';
import { Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { NeuralScanOverlay } from './NeuralScanOverlay';


export function OptimisticCapture({
  onCapture,
}: {
  // onCapture is now optional/fallback, we handle upload internally here
  onCapture?: (blob: Blob) => Promise<any>;
}) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'complete'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ userId, blob }: { userId: string, blob: Blob }) => {
      // 1. Upload to storage
      const { path } = await visionService.uploadScan(userId, blob);

      // 2. Trigger Edge Function
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
    onSuccess: () => {
      setStatus('complete');
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });

      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNative;
      setTimeout(async () => {
        if (isNative) {
          await App.minimizeApp();
        } else {
          router.push('/dashboard');
        }
      }, 800);
    },
    onError: (error: any) => {
      console.error('Upload Process Failed:', error);
      setStatus('idle');
      // Fix for stringifying empty error objects
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

    startCamera();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
      <div className="fixed inset-0 bg-[var(--primary)] flex items-center justify-center z-50 backdrop-blur-md animate-in fade-in duration-300">
        <div className="text-center text-white space-y-4 scale-110 animate-in zoom-in-50 duration-500">
          <div className="bg-white/20 p-6 rounded-[2rem] inline-block backdrop-blur-xl border border-white/20">
            <CheckCircle2 className="w-16 h-16 text-white" />
          </div>
          <div className="space-y-1">
            <h2 className="text-4xl font-black tracking-tight uppercase italic">Linked</h2>
            <p className="text-white/60 font-bold uppercase tracking-widest text-[10px]">Processing Signal...</p>
          </div>
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
