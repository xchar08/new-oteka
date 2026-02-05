'use client';

import { useState, useEffect } from 'react';
import { CameraPreview } from '@capacitor-community/camera-preview';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { HandOverlay } from '@/components/vision/HandOverlay';
import { Loader2, Camera, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LogPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [result, setResult] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // CameraPreview doesn't always have requestCameraPermissions on the plugin itself 
        // in some versions of @capacitor-community/camera-preview. 
        // We'll proceed with start which prompts automatically, or use a check if available.
      }
      
      await CameraPreview.start({
        position: 'rear',
        parent: 'cameraPreview',
        className: 'cameraPreview',
        toBack: true, // Camera is behind WebView
      });
      document.body.classList.add('camera-active'); // Helper for transparency
      setCameraActive(true);
    } catch (e) {
      console.error('Failed to start camera', e);
    }
  };

  const stopCamera = async () => {
    if (cameraActive) {
      try {
        await CameraPreview.stop();
        document.body.classList.remove('camera-active');
        setCameraActive(false);
      } catch (e) {}
    }
  };

  const handleCapture = async () => {
    setAnalyzing(true);
    try {
      let base64Image = '';

      if (Capacitor.isNativePlatform()) {
        const result = await CameraPreview.capture({ quality: 85 });
        base64Image = result.value;
        stopCamera();
      } else {
        // Fallback for Web/Testing (Standard File Input logic would trigger here if we kept it)
        alert("Web Camera not fully implemented. Use Native Device.");
        setAnalyzing(false);
        return;
      }

      await processImage(base64Image);

    } catch (err) {
      console.error(err);
      alert('Capture failed');
      setAnalyzing(false);
      startCamera(); // Restart if failed
    }
  };

  const processImage = async (base64: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/vision-pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) throw new Error('Analysis failed');

      const data = await res.json();
      setResult(data);
    } catch (err) {
      alert('Analysis failed. Try again.');
      startCamera();
    } finally {
      setAnalyzing(false);
    }
  };

  // Fallback for web testing if needed
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      setAnalyzing(true);
      processImage(base64);
    };
    reader.readAsDataURL(file);
  };

  if (result) {
    return (
      <div className="min-h-screen bg-[var(--palenight-bg)] p-6 text-white flex flex-col items-center justify-center space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/50">
            <RefreshCw className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold">{result.summary.name}</h2>
          <p className="text-zinc-400">{result.summary.calories} kcal</p>
        </div>

        <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[var(--palenight-surface)] p-4 space-y-4">
           <div className="grid grid-cols-3 gap-2 text-center">
             <div className="rounded bg-[var(--palenight-bg)] p-2">
               <div className="text-xs text-zinc-500">Protein</div>
               <div className="font-mono font-bold">{result.macros?.protein}g</div>
             </div>
             <div className="rounded bg-[var(--palenight-bg)] p-2">
               <div className="text-xs text-zinc-500">Carbs</div>
               <div className="font-mono font-bold">{result.macros?.carbs}g</div>
             </div>
             <div className="rounded bg-[var(--palenight-bg)] p-2">
               <div className="text-xs text-zinc-500">Fat</div>
               <div className="font-mono font-bold">{result.macros?.fat}g</div>
             </div>
           </div>
           
           <div className="text-xs text-zinc-500">
             Confidence: {Math.round((result.confidence_score || 0) * 100)}%
           </div>
        </div>

        <div className="flex w-full max-w-sm gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { setResult(null); startCamera(); }}>
             Retake
          </Button>
          <Button className="flex-1 bg-blue-600" onClick={() => router.push('/dashboard')}>
             Confirm Log
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-screen w-screen ${cameraActive ? 'bg-transparent' : 'bg-black'} overflow-hidden`}>
        {/* WEBCAM CONTAINER FOR NATIVE PLUGIN */}
        <div id="cameraPreview" className="absolute inset-0 bg-transparent" />

        {/* AR OVERLAY */}
        <HandOverlay />

        {/* UI CONTROLS */}
        <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center space-y-6 z-50">
           
           <div className="text-center text-white/80 text-sm font-medium drop-shadow-md">
             {analyzing ? (
               <span className="flex items-center gap-2 animate-pulse">
                 <Loader2 className="h-4 w-4 animate-spin" /> Analyzing Physics...
               </span>
             ) : (
               "Tap circular button to capture"
             )}
           </div>

           <button 
             onClick={handleCapture}
             disabled={analyzing}
             className="h-20 w-20 rounded-full border-4 border-white/20 flex items-center justify-center bg-white/10 backdrop-blur active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
           >
             <div className="h-16 w-16 rounded-full bg-palenight-accent shadow-lg border border-white/20" />
           </button>

           {/* WEB FALLBACK INPUT (Hidden on Native) */}
           {!Capacitor.isNativePlatform() && (
             <label className="absolute bottom-4 right-4 text-xs text-zinc-500 underline cursor-pointer">
               Web Debug: Upload File
               <input type="file" className="hidden" onChange={handleFileUpload} />
             </label>
           )}
        </div>
    </div>
  );
}
