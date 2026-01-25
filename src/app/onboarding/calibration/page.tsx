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
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Physics Calibration</h1>
      <p className="mb-4 text-gray-600">
        To calculate food volume accurately, we need to know your hand width. 
        Place your hand on a table next to a standard credit card (85.6mm).
      </p>
      
      {/* Real Camera View */}
      <div className="bg-black relative h-64 flex items-center justify-center mb-6 rounded-lg overflow-hidden border-2 border-gray-300">
         <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
         
         {/* AR Overlay Guide */}
         <div className="absolute border-2 border-blue-400 w-32 h-20 rounded opacity-50 flex items-center justify-center">
            <span className="text-blue-200 text-xs bg-black/50 px-1">Credit Card</span>
         </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Measured Hand Width (mm)</label>
        <input 
          type="number" 
          value={mmInput}
          onChange={(e) => setMmInput(e.target.value)}
          placeholder="e.g. 85"
          className="w-full p-2 border rounded"
        />
      </div>

      <button 
        onClick={handleCalibration}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
      >
        {loading ? 'Calibrating...' : 'Save & Continue'}
      </button>
    </div>
  );
}
