'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronRight, Ruler, Camera, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CalibrationPage() {
  const [width, setWidth] = useState(85); // Default 85mm
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    let stream: MediaStream | null = null;

    if (cameraActive) {
      const startCamera = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera access failed:", err);
          setCameraActive(false);
        }
      };
      startCamera();
    }

    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [cameraActive]);

  const handleUpdate = (val: number) => {
    if (val >= 50 && val <= 120) setWidth(val);
  };

  const handleContinue = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { error: updateError } = await supabase.from('users').upsert({ 
        id: user.id,
        hand_width_mm: width,
        updated_at: new Date().toISOString()
      });
      
      if (updateError) {
        alert("CALIBRATION ERROR: " + updateError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    window.location.href = '/dashboard'; 
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 flex flex-col animate-in fade-in duration-500">
      
      <div className="space-y-6 flex-1">
        <header className="pt-safe space-y-2">
          <div className="w-12 h-1 bg-[var(--border)] rounded-full mb-6">
            <div className="w-2/3 h-full bg-[var(--primary)] rounded-full" />
          </div>
          <h1 className="text-3xl font-light tracking-tight">Hand Calibration</h1>
          <p className="text-[var(--text-secondary)]">
            Match the overlay to your palm width in the camera view.
          </p>
        </header>

        <section className="relative aspect-[3/4] bg-black rounded-3xl overflow-hidden shadow-2xl border border-[var(--border)]">
          {!cameraActive ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-4 p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-700">
                <Camera size={40} />
              </div>
              <p className="text-sm">Activate camera to calibrate visually for maximum accuracy.</p>
              <Button 
                variant="outline" 
                onClick={() => setCameraActive(true)}
                className="border-zinc-800 text-zinc-400"
              >
                Enable Camera
              </Button>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute inset-0 w-full h-full object-cover" 
              />
              {/* Visual Alignment Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div 
                  className="border-2 border-dashed border-[var(--primary)] rounded-2xl bg-[var(--primary)]/5 shadow-[0_0_30px_rgba(255,140,0,0.2)] transition-all duration-150"
                  style={{ 
                    width: `${width * 2}px`, 
                    height: `${width * 2.5}px` 
                  }}
                >
                  <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-[var(--primary)]" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-[var(--primary)]" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-[var(--primary)]" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-[var(--primary)]" />
                </div>
              </div>
              <button 
                onClick={() => setCameraActive(false)}
                className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md rounded-full text-white/70"
              >
                <RotateCcw size={16} />
              </button>
            </>
          )}
        </section>

        <div className="space-y-4 pt-4">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-2xl font-black text-[var(--text-primary)] tabular-nums">
                {width}<span className="text-sm font-bold text-[var(--text-secondary)] ml-1">mm</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Adjust Palm Width</div>
            </div>
            <Ruler className="text-[var(--primary)] mb-1" size={20} />
          </div>

          <div className="w-full space-y-4 px-2">
            <input
              type="range"
              min="65"
              max="110"
              value={width}
              onChange={(e) => handleUpdate(Number(e.target.value))}
              className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
            />
            <div className="flex justify-between text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter">
              <span>Narrow (65mm)</span>
              <span>Wide (110mm)</span>
            </div>
          </div>
        </div>
      </div>

      <Button 
        onClick={handleContinue} 
        disabled={loading}
        className="w-full h-14 bg-[var(--primary)] text-[var(--primary-fg)] hover:opacity-90 rounded-2xl font-semibold shadow-lg text-lg flex items-center justify-center gap-2 mt-8"
      >
        {loading ? 'Finalizing...' : 'Complete Setup'} <ChevronRight size={20} />
      </Button>
    </div>
  );
}
