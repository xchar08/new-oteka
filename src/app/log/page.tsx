'use client';

import { useState, useEffect, useRef } from 'react';
import { CameraPreview } from '@capacitor-community/camera-preview';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { HandOverlay } from '@/components/vision/HandOverlay';
import { Loader2, RefreshCw, ChevronLeft, Check, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { runClientInference } from '@/lib/vision/client-inference';

const loadImage = (base64: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/jpeg;base64,${base64}`;
  });
};

export default function LogPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [debugLog, setDebugLog] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false); // Default Hidden
  const [enable3D, setEnable3D] = useState(false); // NEW: 3D Toggle
  const supabase = createClient();
  const router = useRouter();
  const isMounted = useRef(true);
  const isProcessing = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    if (Capacitor.isNativePlatform()) {
      startCamera();
    }
    
    // Cleanup function
    return () => {
      isMounted.current = false;
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { camera } = await CapacitorCamera.requestPermissions();
        if (camera !== 'granted') {
          console.warn('Camera permission not granted');
          return;
        }
      }
      
      await CameraPreview.stop().catch(() => {});

      await CameraPreview.start({
        position: 'rear',
        parent: 'cameraPreview',
        className: 'cameraPreview',
        toBack: true, 
        disableAudio: true,
      });

      if (isMounted.current) {
        document.body.classList.add('camera-active'); 
        document.documentElement.classList.add('camera-active');
        setCameraActive(true);
      }
    } catch (e) {
      console.error('Failed to start camera', e);
    }
  };

  const stopCamera = async () => {
    try {
      await CameraPreview.stop();
    } catch (e) {
      // Ignore errors when stopping
    } finally {
        document.body.classList.remove('camera-active');
        document.documentElement.classList.remove('camera-active');
        if (isMounted.current) setCameraActive(false);
    }
  };

  const handleCapture = async () => {
    if (analyzing || isProcessing.current) return;
    isProcessing.current = true;
    setAnalyzing(true);
    setErrorMsg(null);
    setDebugLog(null);
    setResult(null);
    
    try {
      let base64Image = '';

      if (Capacitor.isNativePlatform()) {
        const result = await CameraPreview.capture({ quality: 85 });
        base64Image = result.value;
      } else {
        alert("Web Camera not fully implemented. Use Native Device.");
        setAnalyzing(false);
        isProcessing.current = false;
        return;
      }

      await processImage(base64Image);

    } catch (err) {
      console.error(err);
      setErrorMsg('Capture failed. Please try again.');
      setAnalyzing(false);
      isProcessing.current = false;
    }
  };

  const processImage = async (base64: string) => {
    try {
      stopCamera();

      // Helper to perform the actual fetch
      const performRequest = async (activeToken: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        
        try {
           return await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/vision-pipeline`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // GATEWAY BYPASS: Send Anon Key to pass Supabase Gateway
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                // FUNCTION AUTH: Send actual User Token for manual verification
                'x-user-token': activeToken
              },
              body: JSON.stringify({
                image: base64,
                mode: 'log', 
              }),
              signal: controller.signal
            }
          );
        } finally {
            clearTimeout(timeoutId);
        }
      };

      // 1. First Attempt + Edge Inference in Parallel
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
         setErrorMsg("Authentication missing. Please log in.");
         return;
      }

      if (isMounted.current) {
        setDebugLog({ 
           status: "Requesting...", 
           url: "vision-pipeline",
           token_preview: session.access_token.substring(0, 10) + "...",
           edge_status: enable3D ? "Initializing Neural Engine..." : "Disabled"
        });
      }

      // LAUNCH PARALLEL TASKS
      const geminiPromise = performRequest(session.access_token);
      let edgePromise = Promise.resolve(null as any);

      if (enable3D) {
          edgePromise = loadImage(base64)
            .then(img => runClientInference(img))
            .catch(e => ({ error: "Edge Inference Failed", details: e }));
      }

      // Wait for Gemini (Primary)
      let res = await geminiPromise;
      let textBody = await res.text();

      // Retry Logic for Gemini
      if (res.status === 401) {
         if (isMounted.current) {
             setDebugLog((prev: any) => ({ ...prev, status: "401 detected. Refreshing Session..." }));
         }
         
         const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
         
         if (refreshError || !refreshData.session) {
             console.error("Critical Refresh Failure:", refreshError);
             throw new Error("Session expired. Please use the button below to fix.");
         }

         // Retry with new token
         res = await performRequest(refreshData.session.access_token);
         textBody = await res.text();
         
         if (res.status === 401) {
             let serverDiag = null;
             try { serverDiag = JSON.parse(textBody); } catch {}
             
             const err = new Error("Authentication refused. Please Re-authenticate.");
             (err as any).serverDiag = serverDiag;
             throw err;
         }
      }

      // Parse Gemini Result
      let data;
      try {
        data = JSON.parse(textBody);
      } catch (e) {
        console.warn("Non-JSON response:", textBody);
        data = { error: "Invalid JSON from server", debug_auth: { raw_response: textBody } };
      }
      
      // Wait for Edge Result (if any)
      if (enable3D) {
         if (isMounted.current) setDebugLog((prev: any) => ({ ...prev, edge_status: "Computing Volumetrics..." }));
         const edgeResult = await edgePromise;
         data.edge_intelligence = edgeResult; // Merge into data
      }

      if (isMounted.current) {
        setDebugLog(data);
      }

      if (!res.ok) {
        throw new Error(data.error || `Server Error: ${res.status}`);
      }

      // Sanitize Data to prevent Crash
      const safeData = {
          items: Array.isArray(data.items) ? data.items : (data.item ? [data.item] : ['Unknown']),
          macros: {
              calories: Number(data.macros?.calories) || 0,
              protein: Number(data.macros?.protein) || 0,
              carbs: Number(data.macros?.carbs) || 0,
              fat: Number(data.macros?.fat) || 0,
          },
          bounding_box: Array.isArray(data.bounding_box) && data.bounding_box.length === 4 
              ? data.bounding_box 
              : undefined,
          summary: { name: 'Use items[0]', calories: 0 },
          // Pass Edge Data to Result for display if needed
          edge_intelligence: data.edge_intelligence
      };

      if (isMounted.current) {
        setResult(safeData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Vision Pipeline Error:", message, err);
      
      if (isMounted.current) { 
        setErrorMsg(message);
        setDebugLog((prev: any) => ({
             ...prev,
             error: message,
             debug_auth: { 
                 client_error: message, 
                 server_diag: (err as any).serverDiag,
                 last_state: prev 
             } 
        }));
        
        startCamera();
      }
    } finally {
      if (isMounted.current) setAnalyzing(false);
      isProcessing.current = false;
    }
  };

  const handleForceLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Fallback for web testing
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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-between p-6 animate-in fade-in duration-500">
        
        {/* Header / Summary */}
        <div className="flex flex-col items-center gap-2 mt-12 text-center animate-in slide-in-from-bottom-5 duration-700 delay-100 fill-mode-both">
             <div className="h-24 w-24 rounded-full bg-linear-to-br from-emerald-400/20 to-emerald-600/20 flex items-center justify-center ring-1 ring-emerald-500/50 shadow-[0_0_30px_-5px_var(--success)] mb-6 animate-in zoom-in-50 duration-500 delay-200 fill-mode-both">
                <Check className="h-12 w-12 text-emerald-400" />
             </div>
             <h1 className="text-4xl font-light tracking-tight text-white capitalize">{result.items?.[0] || 'Unknown Food'}</h1>
             <p className="text-emerald-400 font-medium text-xl mt-1">{result.macros?.calories || 0} kcal</p>
             
             {/* Edge Intelligence Badge */}
             {result.edge_intelligence && (
                 <div className="mt-2 px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] border border-purple-500/30">
                    Depth: {(result.edge_intelligence.volumetric?.mean_depth || 0).toFixed(2)}m (Est)
                 </div>
             )}
        </div>

        {/* Macro Cards */}
        <div className="w-full max-w-sm grid grid-cols-3 gap-3 animate-in slide-in-from-bottom-10 duration-700 delay-300 fill-mode-both">
            {[
                { label: 'Protein', value: result.macros?.protein, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', delay: 'delay-300' },
                { label: 'Carbs', value: result.macros?.carbs, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', delay: 'delay-400' },
                { label: 'Fat', value: result.macros?.fat, color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', delay: 'delay-500' }
            ].map((macro) => (
                <div key={macro.label} className={`rounded-2xl border ${macro.color} p-4 flex flex-col items-center justify-center gap-1 backdrop-blur-sm`}>
                    <span className="text-xs uppercase tracking-wider opacity-70">{macro.label}</span>
                    <span className="text-2xl font-bold">{macro.value}g</span>
                </div>
            ))}
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-sm flex gap-3 mb-8 animate-in slide-in-from-bottom-5 duration-700 delay-500 fill-mode-both">
            <Button 
                variant="outline" 
                className="flex-1 h-16 rounded-2xl border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 hover:text-white transition-all text-lg font-medium"
                onClick={() => { setResult(null); startCamera(); }}
            >
                Retake
            </Button>
            <Button 
                className="flex-1 h-16 rounded-2xl bg-white text-black hover:bg-zinc-200 font-semibold shadow-lg shadow-white/10 transition-all text-lg"
                onClick={() => {
                    stopCamera(); // Ensure stopped before nav
                    router.push('/dashboard');
                }}
            >
                Confirm Log
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-screen w-screen overflow-hidden ${cameraActive ? 'bg-transparent' : 'bg-black'}`}>
        {/* WEBCAM CONTAINER */}
        <div id="cameraPreview" className="absolute inset-0 bg-transparent z-0" />

        {/* GRADIENT OVERLAYS - Cinematic View */}
        <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-black/90 via-black/50 to-transparent z-10 pointer-events-none" />

        {/* BACK NAVIGATION */}
        <button 
            onClick={() => router.back()}
            className="absolute top-6 left-6 z-50 p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white active:scale-95 transition-transform"
        >
            <ChevronLeft className="h-6 w-6" />
        </button>

        {/* AR GUI */}
        <HandOverlay 
            status={analyzing ? 'scanning' : (result ? 'locked' : 'idle')} 
            boundingBox={result?.bounding_box}
        />

        {/* DEBUG OVERLAY (Moved to top-level, below header area) */}
        {showDebug && (
            <div className="absolute top-24 left-4 right-4 z-[60] pointer-events-auto animate-in slide-in-from-top-5 fade-in duration-300">
                <div className="bg-black/90 rounded-xl p-4 text-[11px] font-mono backdrop-blur-xl border border-white/20 shadow-2xl overflow-y-auto max-h-[50vh] flex flex-col gap-3">
                     
                     {/* Header: Status & Network */}
                     <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${analyzing ? "bg-yellow-400 animate-pulse" : "bg-emerald-400"}`} />
                            <span className="font-bold text-white tracking-wider">{analyzing ? 'Processing...' : 'System Ready'}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${navigator.onLine ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                            {navigator.onLine ? 'ONLINE' : 'OFFLINE'}
                        </span>
                     </div>
                     
                     {/* 3D Toggle */}
                     <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/10">
                        <span className="text-purple-300 font-bold">Edge Intelligence (Beta)</span>
                        <button 
                             onClick={() => setEnable3D(!enable3D)}
                             className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${enable3D ? 'bg-purple-500 text-white' : 'bg-white/10 text-white/50'}`}
                        >
                            {enable3D ? 'ENABLED' : 'DISABLED'}
                        </button>
                     </div>
                     <p className="text-[10px] text-zinc-500 mt-[-8px] mb-1">*Requires ~50MB Model Download</p>

                     {/* Log Viewer */}
                     <div className="flex flex-col gap-1">
                        <span className="text-white/40 text-[9px] uppercase tracking-widest">Console Log ({new Date().toLocaleTimeString()})</span>
                        <div className="bg-white/5 p-2 rounded border border-white/5 text-blue-200 break-all whitespace-pre-wrap font-mono">
                            {JSON.stringify(debugLog || { status: 'Waiting for input...' }, null, 2)}
                        </div>
                     </div>

                     {/* Error Box */}
                     {errorMsg && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-200 flex flex-col gap-3">
                            <div className="flex items-start gap-2">
                                <div className="mt-0.5 min-w-[16px] text-red-500">⚠</div>
                                <div className="flex flex-col gap-1">
                                    <span className="font-bold text-red-400">Error Detected</span>
                                    <p className="leading-tight">{errorMsg}</p>
                                    {errorMsg.includes("Failed to fetch") && (
                                        <p className="text-[10px] text-red-300/70 italic">
                                            *Usually unrelated to Auth. Check internet or server CORS configuration.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Fix Actions */}
                            {(errorMsg.includes("401") || errorMsg.includes("Auth") || errorMsg.includes("JWT")) && (
                                <button 
                                    onClick={handleForceLogout}
                                    className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-md shadow-lg transition-colors w-full"
                                >
                                    Relink Account (Force Logout)
                                </button>
                            )}
                        </div>
                     )}

                     {/* Server Info (Manual Check) */}
                     <div className="text-[9px] text-white/30 border-t border-white/5 pt-2 flex justify-between">
                         <span>v0.1.0-beta</span>
                         <span>{process.env.NEXT_PUBLIC_SUPABASE_URL?.split('://')[1]?.split('.')[0]}</span>
                     </div>
                </div>
            </div>
        )}

        {/* CONTROLS */}
        <div className="absolute bottom-12 left-0 right-0 z-50 flex flex-col items-center justify-end gap-8 pb-safe">
            
            <div className="text-center space-y-1">
                {analyzing ? (
                     <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-emerald-500/20 text-white/90 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                        <span className="text-sm font-medium tracking-wide">Analyzing Food...</span>
                     </div>
                ) : (
                    <button 
                        onClick={() => setShowDebug(!showDebug)} 
                        className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-medium hover:text-white/80 transition-colors"
                    >
                        {showDebug ? 'HIDE DEBUG' : 'TAP FOR DEBUG'}
                    </button>
                )}
            </div>

            <div className="relative">
                {/* Outer Ring - Breathing Animation */}
                <div className={`absolute inset-0 rounded-full border border-white/10 scale-110 transition-transform duration-[2000ms] ${analyzing ? 'animate-pulse opacity-20' : 'animate-[ping_3s_ease-in-out_infinite] opacity-10'}`} />
                
                {/* Capture Button - Glassmorphic */}
                <button 
                    onClick={handleCapture}
                    disabled={analyzing}
                    className="group relative h-20 w-20 rounded-full border-[3px] border-white/80 flex items-center justify-center bg-white/5 backdrop-blur-sm active:scale-95 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <div className="h-16 w-16 rounded-full bg-white group-active:scale-90 transition-transform duration-200 shadow-inner" />
                </button>
            </div>

            {/* WEB DEBUGGER (Only shows in browser) */}
            {!Capacitor.isNativePlatform() && (
                <div className="absolute bottom-4 right-4 z-50">
                     <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur text-xs text-white/70 cursor-pointer hover:bg-white/20 transition-colors">
                        <Camera className="h-3 w-3" />
                        Debug Upload
                        <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>
            )}
        </div>
    </div>
  );
}
