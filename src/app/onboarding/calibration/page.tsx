'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronRight, Ruler } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CalibrationPage() {
  const [width, setWidth] = useState(85); // Default 85mm
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleUpdate = (val: number) => {
    if (val >= 50 && val <= 120) setWidth(val);
  };

  const handleContinue = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase.from('users').update({ hand_width_mm: width }).eq('id', user.id);
    }

    setLoading(false);
    // Determine next step - usually Dashboard
    router.push('/dashboard'); 
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 flex flex-col justify-between animate-in fade-in duration-500">
      
      <div className="space-y-8">
        <header className="pt-safe space-y-2">
          <div className="w-12 h-1 bg-[var(--border)] rounded-full mb-6">
            <div className="w-2/3 h-full bg-[var(--primary)] rounded-full" />
          </div>
          <h1 className="text-3xl font-light tracking-tight">Optics Calibration</h1>
          <p className="text-[var(--text-secondary)]">
            We use your hand as a reference scale to calculate absolute volumetric density.
          </p>
        </header>

        <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 flex flex-col items-center gap-6 shadow-sm">
           <div className="w-24 h-24 bg-[var(--bg-app)] rounded-full flex items-center justify-center text-[var(--primary)] shadow-inner">
             <Ruler size={40} />
           </div>

           <div className="text-center space-y-1">
             <div className="text-4xl font-light tracking-tight tabular-nums">
               {width}<span className="text-lg text-[var(--text-secondary)] font-normal ml-1">mm</span>
             </div>
             <div className="text-xs text-[var(--text-secondary)] uppercase tracking-widest font-bold">
               Palm Width
             </div>
           </div>

           <div className="w-full space-y-4">
             <input
               type="range"
               min="50"
               max="110"
               value={width}
               onChange={(e) => handleUpdate(Number(e.target.value))}
               className="w-full h-2 bg-[var(--bg-surface-2)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
             />
             <div className="flex justify-between text-xs text-[var(--text-secondary)] font-mono">
               <span>50mm</span>
               <span>110mm</span>
             </div>
           </div>
        </section>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-[var(--primary)] leading-relaxed">
          <strong>Why?</strong> Accurate scale data improves caloric estimation precision by up to 40% when using single-camera depth estimation.
        </div>
      </div>

      <Button 
        onClick={handleContinue} 
        disabled={loading}
        className="w-full h-14 bg-[var(--primary)] text-[var(--primary-fg)] hover:opacity-90 rounded-2xl font-semibold shadow-lg text-lg flex items-center justify-center gap-2"
      >
        {loading ? 'Calibrating...' : 'Complete Setup'} <ChevronRight size={20} />
      </Button>
    </div>
  );
}
