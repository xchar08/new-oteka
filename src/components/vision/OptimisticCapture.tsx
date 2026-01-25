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
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    }

    startCamera().catch((e) => {
      console.error(e);
      alert('Camera permission is required.');
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
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (!blob) throw new Error('capture_failed');

      // UX requirement: keep foreground until upload ack (we enforce >= 1.5s) [file:37]
      const uploadPromise = onCapture(blob);
      const timerPromise = new Promise((r) => setTimeout(r, 1500));
      const [uploadResult] = (await Promise.all([uploadPromise, timerPromise])) as any[];

      setStatus('complete');

      // schedule local notification ~5s later (matches spec “push arrives 5s later”) [file:37]
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNative;

      if (isNative) {
        await LocalNotifications.requestPermissions();
        const calories = uploadResult?.total_calories;
        const summary = uploadResult?.summary;

        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title: 'Oteka',
              body: calories
                ? `${Math.round(calories)} kcal logged${summary ? ` (${summary})` : ''}`
                : 'Log completed.',
              schedule: { at: new Date(Date.now() + 5000) },
            },
          ],
        });
      }

      // minimize after upload ack (not before) [file:37]
      setTimeout(async () => {
        if (isNative) {
          await App.minimizeApp();
        } else {
          router.push('/dashboard');
        }
      }, 500);
    } catch (e: any) {
      console.error(e);
      alert('Upload Failed');
      setStatus('idle');
    }
  };

  if (status === 'uploading') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="w-64 space-y-4">
          <div className="text-white text-center font-bold">Uploading Analysis...</div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 animate-[width_1.5s_ease-out_forwards]"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div className="fixed inset-0 bg-green-600 flex items-center justify-center z-50">
        <div className="text-white text-3xl font-bold">Done!</div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="border-2 border-white/30 w-64 h-64 rounded-full border-dashed opacity-50" />
        <p className="absolute bottom-32 text-white/80 font-medium text-sm bg-black/40 px-3 py-1 rounded-full">
          Align food within circle
        </p>
      </div>
      <div className="absolute bottom-12 left-0 right-0 flex justify-center z-10">
        <button
          onClick={handleClick}
          className="w-20 h-20 bg-white rounded-full border-4 border-gray-200/50 shadow-lg active:scale-95 transition-transform"
        />
      </div>
    </div>
  );
}
