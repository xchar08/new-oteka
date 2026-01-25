'use client';

import { useState, useRef } from 'react';
import { runClientInference } from '@/lib/vision/client-inference';
import { storeOfflineVisionData } from '@/lib/vision/offline-store';
import { useConnectionMode } from '@/lib/hooks/useConnectionMode';

export default function OfflineCapturePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [processing, setProcessing] = useState(false);
  
  useConnectionMode(); 

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setProcessing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      
      const img = new Image();
      img.src = canvas.toDataURL('image/jpeg', 0.8);
      
      // FIX: Ensure image is loaded before inference
      await new Promise((resolve) => { img.onload = resolve });

      // Node A (Client ML)
      const inference = await runClientInference(img);
      
      // Queue for Sync
      await storeOfflineVisionData('current-user-id', inference, img.src.split(',')[1]);

      alert("Logged Offline! Will sync when connection restores.");
      
    } catch (e: any) {
      console.error(e);
      alert("Offline processing failed: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
      <div className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded text-xs font-bold">
        OFFLINE MODE (Node A Active)
      </div>
      
      <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-md rounded-lg" />
      
      <div className="absolute border-2 border-yellow-400 opacity-50 w-48 h-64 rounded-full pointer-events-none mb-12">
        <span className="absolute -top-6 w-full text-center text-yellow-400 text-sm">Align Hand Here</span>
      </div>

      <button 
        onClick={handleCapture}
        disabled={processing}
        className="absolute bottom-10 bg-white text-black w-16 h-16 rounded-full border-4 border-gray-300 flex items-center justify-center"
      >
        {processing ? '...' : ''}
      </button>
    </div>
  );
}
