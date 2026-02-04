'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { createClient } from '@/lib/supabase/client';
import { storeOfflineVisionData } from '@/lib/vision/offline-store'; // ✅ Added offline fallback

export function OptimisticCapture({
  onCapture,
}: {
  // onCapture is now optional/fallback, we handle upload internally here
  onCapture?: (blob: Blob) => Promise<any>;
}) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'complete'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

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
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (!blob) throw new Error('capture_failed');

      // Convert Blob to Base64 for Edge Function
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });

      const base64Image = await base64Promise;

      // ✅ FIXED: Get session & add Authorization header
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Please log in first');
      }

      // CALL SUPABASE EDGE FUNCTION with auth
      const functionPromise = supabase.functions.invoke('vision-pipeline', {
        body: { image: base64Image },
        headers: {
          Authorization: `Bearer ${session.access_token}`  // ✅ CRITICAL FIX
        }
      });

      // UX requirement: keep foreground until upload ack (>= 1.5s)
      const timerPromise = new Promise((r) => setTimeout(r, 1500));
      
      // Wait for both
      const [funcResult] = await Promise.all([functionPromise, timerPromise]);

      if (funcResult.error) {
        console.error('Edge Function Error:', funcResult.error);
        // ✅ FALLBACK: Save offline
        await storeOfflineVisionData('current-user-id', { 
          calories: 0, 
          name: 'Unknown (offline)' 
        }, base64Image);
        throw new Error('Server unavailable - saved offline');
      }

      const data = funcResult.data; // The JSON response from Edge Function
      setStatus('complete');

      // Schedule notification
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNative;

      if (isNative) {
        await LocalNotifications.requestPermissions();
        const calories = data?.summary?.calories;
        const name = data?.summary?.name;

        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title: 'Oteka Analysis Complete',
              body: calories
                ? `${Math.round(calories)} kcal logged (${name || 'Food'})`
                : 'Your food log has been processed.',
              schedule: { at: new Date(Date.now() + 5000) },
              smallIcon: "ic_stat_icon_config_sample",
              sound: "beep.wav"
            },
          ],
        });
      }

      // Minimize app
      setTimeout(async () => {
        if (isNative) {
          await App.minimizeApp();
        } else {
          router.push('/dashboard');
        }
      }, 800);
      
    } catch (e: any) {
      console.error(e);
      alert('Upload Failed: ' + (e.message || 'Unknown error'));
      setStatus('idle');
    }
  };

  if (status === 'uploading') {
    return (
      <div className="fixed inset-0 bg-palenight-bg flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="w-64 space-y-6 text-center">
          <div className="text-white text-xl font-bold animate-pulse">Analyzing...</div>
          <div className="h-2 bg-palenight-surface rounded-full overflow-hidden w-full">
            <div
              className="h-full bg-palenight-accent animate-[width_1.5s_ease-out_forwards]"
              style={{ width: '100%' }}
            />
          </div>
          <p className="text-gray-400 text-xs">Identifying food & calculating volume</p>
        </div>
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div className="fixed inset-0 bg-palenight-success flex items-center justify-center z-50 animate-in fade-in duration-300">
        <div className="text-center text-white space-y-2">
          <div className="text-6xl mb-4">✓</div>
          <div className="text-3xl font-bold">Logged!</div>
          <p className="text-green-100">Check your notification in 5s</p>
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
