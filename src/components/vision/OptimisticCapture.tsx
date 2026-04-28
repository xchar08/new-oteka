'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { createClient } from '@/lib/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { visionService } from '@/lib/services/vision.service';
import { Sparkles, CheckCircle2, Scan, Loader2 } from 'lucide-react';
import { toast } from 'sonner';


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

  const uploadMutation = useMutation({
    mutationFn: async ({ userId, blob }: { userId: string, blob: Blob }) => {
      const { path } = await visionService.uploadScan(userId, blob);

      // ✅ TRIGGER EDGE FUNCTION (Modern Storage-First Path)
      // We call the function with the path. The function downloads it and inserts the log.
      const { data, error } = await supabase.functions.invoke('vision-pipeline', {
        body: { 
          imagePath: path,
          mode: 'log'
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setStatus('complete');
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });

      // Minimize app after a short delay
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
      console.error('Upload Failed:', error);
      setStatus('idle');
      toast.error('Upload failed: ' + (error.message || 'Unknown error'));
    }
  });

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      // Prioritize the environment (rear) camera
      stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1080 },
          height: { ideal: 1920 } 
        },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    }

    startCamera().catch((e) => {
      console.error(e);
      alert('Camera permission is required to log food.');
    });

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleClick = async () => {
    if (!videoRef.current) return;

    setStatus('uploading');

    try {
      const canvas = document.createElement('canvas');
      
      // ✅ MEMORY FIX: Downscale high-res camera feeds
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
      if (!blob) throw new Error('capture_failed');

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Please log in first');
      }

      // DIRECT UPLOAD (Storage-First)
      await uploadMutation.mutateAsync({ userId: user.id, blob });

      // Schedule notification
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNative;

      if (isNative) {
        await LocalNotifications.requestPermissions();

        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title: 'Oteka Analysis Started',
              body: 'Your meal is being analyzed in the background.',
              schedule: { at: new Date(Date.now() + 2000) },
              smallIcon: "ic_stat_icon_config_sample",
              sound: "beep.wav"
            },
          ],
        });
      }
    } catch (e: any) {
      console.error('Capture/Upload Error:', e);
      setStatus('idle');
    }
  };

  if (status === 'uploading') {
    return (
      <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 backdrop-blur-md transition-all duration-300">
        <div className="w-72 p-8 rounded-[2rem] bg-card border border-border shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-[3px] border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-[3px] border-primary border-t-transparent animate-spin"></div>
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <div className="space-y-2 text-center">
            <h3 className="text-xl font-bold tracking-tight text-foreground">Analyzing Meal</h3>
            <p className="text-sm text-muted-foreground font-medium">Extracting nutritional data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div className="fixed inset-0 bg-emerald-500 flex items-center justify-center z-50 backdrop-blur-md animate-in fade-in duration-300">
        <div className="text-center text-white space-y-4 scale-110 animate-in zoom-in-50 duration-500">
          <div className="bg-white/20 p-4 rounded-full inline-block backdrop-blur-xl">
            <CheckCircle2 className="w-16 h-16 text-white" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight">Logged!</h2>
            <p className="text-white/80 font-medium text-sm">Processing in background...</p>
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
        className="absolute inset-0 w-full h-full object-cover" 
      />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <img 
          src="/hand-overlay.svg" 
          alt="Alignment Guide" 
          className="w-72 h-auto opacity-70 drop-shadow-lg" 
        />
        <p className="absolute bottom-32 text-white/90 font-medium text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
          Align food within dashed area
        </p>
      </div>
      <div className="absolute bottom-12 left-0 right-0 flex justify-center z-10">
        <button
          onClick={handleClick}
          className="w-20 h-20 bg-white rounded-full border-4 border-gray-200/50 shadow-lg active:scale-95 transition-transform"
          aria-label="Capture Photo"
        />
      </div>
    </div>
  );
}
