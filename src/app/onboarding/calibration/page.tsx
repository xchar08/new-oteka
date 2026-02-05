'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function CalibrationPage() {
  const [mmInput, setMmInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const supabase = createClient();
  const router = useRouter();

  // Start Camera on Mount
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error("Camera access denied", e);
      }
    }
    startCamera();

    // Cleanup
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleCalibration = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user && mmInput) {
      const { error } = await supabase
        .from('users')
        .update({ hand_width_mm: parseFloat(mmInput) })
        .eq('id', user.id);
        
      if (!error) {
        alert("Calibration Saved. Physics Core Active.");
        router.push('/dashboard');
      } else {
        alert("Error saving: " + error.message);
      }
    } else {
      alert("Please enter a valid width.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-palenight-bg p-6 max-w-md mx-auto text-zinc-100">
      <h1 className="text-2xl font-bold mb-4 text-white">Physics Calibration</h1>
      <p className="mb-6 text-zinc-400">
        To calculate food volume accurately, we need to know your hand width. 
        Place your hand on a table next to a standard credit card (85.6mm).
      </p>
      
      {/* Real Camera View */}
      <div className="bg-black relative h-64 flex items-center justify-center mb-8 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
         <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
         
         {/* AR Overlay Guide */}
         <div className="absolute border-2 border-palenight-secondary w-32 h-20 rounded-lg opacity-50 flex items-center justify-center pointer-events-none">
            <span className="text-palenight-secondary text-xs bg-black/50 px-2 py-0.5 rounded">Credit Card</span>
         </div>

         {/* Side Calibrate Action */}
         <button 
           onClick={() => alert('AR Auto-Calibration feature coming in v1.1')}
           className="absolute right-2 bottom-2 bg-palenight-surface/80 backdrop-blur text-white p-2 rounded-full border border-white/10 shadow-lg active:scale-95"
           title="Auto-Calibrate"
         >
            <div className="w-6 h-6 border-2 border-palenight-success rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-palenight-success rounded-full" />
            </div>
         </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2 text-zinc-400">Measured Hand Width (mm)</label>
        <input 
          type="number" 
          value={mmInput}
          onChange={(e) => setMmInput(e.target.value)}
          placeholder="e.g. 85"
          className="w-full p-3 bg-palenight-surface border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-palenight-accent outline-none transition-all"
        />
      </div>

      <button 
        onClick={handleCalibration}
        disabled={loading}
        className="w-full bg-palenight-accent hover:brightness-110 text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-all"
      >
        {loading ? 'Calibrating...' : 'Save & Continue'}
      </button>
    </div>
  );
}
