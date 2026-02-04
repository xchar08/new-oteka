'use client';

import { useState, useRef, useEffect } from 'react';
import { runClientInference } from '@/lib/vision/client-inference';
import { storeOfflineVisionData } from '@/lib/vision/offline-store';
import { useConnectionMode } from '@/lib/hooks/useConnectionMode';

export default function OfflineCapturePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [processing, setProcessing] = useState(false);
  
  useConnectionMode(); 

  // ✅ Auto-start camera when component mounts
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment', // Back camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera access denied:', err);
        alert('Camera access required for offline logging');
      }
    };
    startCamera();

    // Cleanup camera stream on unmount
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setProcessing(true);

    try {
      // 1. Capture frame from video
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      
      ctx.drawImage(videoRef.current, 0, 0);
      
      // 2. Convert to base64 JPEG
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = imgData.split(',')[1];

      // 3. Ensure image is loaded before inference
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgData;
      });

      // 4. Node A (Client ML)
      const inference = await runClientInference(img);
      
      // 5. Queue for Sync
      await storeOfflineVisionData('current-user-id', inference, base64);

      alert("✅ Logged Offline! Will sync when connection restores.");
      
    } catch (e: any) {
      console.error('Offline capture failed:', e);
      alert("Offline processing failed: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center text-white relative overflow-hidden">
      {/* Offline Badge */}
      <div className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded-full text-xs font-bold z-20">
        OFFLINE MODE (Node A Active)
      </div>
      
      {/* Camera View */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-cover"
      />
      
      {/* Alignment Guide */}
      <div className="absolute border-4 border-yellow-400 opacity-50 w-48 h-64 rounded-lg pointer-events-none mb-12 z-10 animate-pulse">
        <span className="absolute -top-8 w-full text-center text-yellow-400 text-xs font-bold">
          Align Food Here
        </span>
      </div>

      {/* Capture Button */}
      <button 
        onClick={handleCapture}
        disabled={processing || !videoRef.current?.srcObject}
        className="absolute bottom-12 bg-palenight-accent text-white w-20 h-20 rounded-full border-4 border-white/20 flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all z-20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {processing ? (
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          '📸'
        )}
      </button>
    </div>
  );
}
