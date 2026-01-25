'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';

export function OptimisticCapture({
  onCapture,
}: {
  onCapture: (blob: Blob) => Promise<{ total_calories?: number; summary?: string } | void>;
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
      
      // Mirror if using front camera, but usually we use rear.
      // For rear camera, standard draw is fine.
      ctx?.drawImage(videoRef.current, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (!blob) throw new Error('capture_failed');

      // UX requirement: keep foreground until upload ack (we enforce >= 1.5s)
      const uploadPromise = onCapture(blob);
      const timerPromise = new Promise((r) => setTimeout(r, 1500));
      
      // Wait for both to finish
      const [uploadResult] = (await Promise.all([uploadPromise, timerPromise])) as any[];

      setStatus('complete');

      // Schedule local notification ~5s later (matches spec "push arrives 5s later")
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNative;

      if (isNative) {
        // Request permissions if not already granted
        await LocalNotifications.requestPermissions();
        
        const calories = uploadResult?.total_calories;
        const summary = uploadResult?.summary;

        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title: 'Oteka Analysis Complete',
              body: calories
                ? `${Math.round(calories)} kcal logged${summary ? ` (${summary})` : ''}`
                : 'Your food log has been processed.',
              schedule: { at: new Date(Date.now() + 5000) },
              smallIcon: "ic_stat_icon_config_sample", // Ensure this exists in Android res
              sound: "beep.wav"
            },
          ],
        });
      }

      // Minimize app after upload ack (not before)
      setTimeout(async () => {
        if (isNative) {
          await App.minimizeApp();
        } else {
          router.push('/dashboard');
        }
      }, 800); // Slight delay so user sees the "Done!" checkmark
      
    } catch (e: any) {
      console.error(e);
      alert('Upload Failed. Please try again.');
      setStatus('idle');
    }
  };

  if (status === 'uploading') {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="w-64 space-y-6 text-center">
          <div className="text-white text-xl font-bold animate-pulse">Analyzing...</div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden w-full">
            <div
              className="h-full bg-blue-500 animate-[width_1.5s_ease-out_forwards]"
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
      <div className="fixed inset-0 bg-green-600 flex items-center justify-center z-50 animate-in fade-in duration-300">
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
      {/* Viewfinder */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="absolute inset-0 w-full h-full object-cover" 
      />
      
      {/* AR Overlay Layer */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {/* The SVG asset acts as the semantic guide */}
        <img 
          src="/hand-overlay.svg" 
          alt="Alignment Guide" 
          className="w-72 h-auto opacity-70 drop-shadow-lg" 
        />
        
        <p className="absolute bottom-32 text-white/90 font-medium text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
          Align food within dashed area
        </p>
      </div>

      {/* Shutter Button */}
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
