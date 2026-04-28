'use client';

import { useState } from 'react';
import { Camera as LucideCamera, AlertCircle, RefreshCw, ChevronLeft, Sparkles, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';

export default function MenuScannerPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleNativeCamera = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64
      });
      if (image.base64String) {
          setAnalyzing(true);
          const { data, error } = await supabase.functions.invoke('vision-menu', {
            body: { image: image.base64String, goal: 'travel' }, 
          });
          if (error) throw new Error(error.message);
          setResult(data);
          setAnalyzing(false);
      }
    } catch (e) {
        console.error("Camera failed", e);
    }
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const { data, error } = await supabase.functions.invoke('vision-menu', {
            body: { image: base64, goal: 'travel' },
        });
        if (error) throw error;
        setResult(data);
        setAnalyzing(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError('Could not read menu. Please try again.');
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] p-6 pb-32 text-[var(--text-primary)] transition-colors duration-500">
      <header className="flex items-center justify-between pt-safe mb-8">
        <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] shadow-sm">
                <ChevronLeft size={24} />
            </button>
            <div>
                <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Menu Parser</h1>
                <p className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest">Travel Optimization</p>
            </div>
        </div>
        <div className="w-12 h-12 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl flex items-center justify-center text-[var(--primary)] shadow-sm">
            <LucideCamera size={24} />
        </div>
      </header>

      {error && (
        <div className="bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20 p-4 rounded-2xl flex items-center gap-3 mb-6 font-medium text-sm">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!result && !analyzing && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={handleNativeCamera}
              className="relative border-2 border-dashed border-[var(--border)] h-80 flex items-center justify-center rounded-[40px] bg-[var(--bg-surface)] hover:border-[var(--primary)] transition-all cursor-pointer group active:scale-[0.98] shadow-sm"
            >
              <div className="flex flex-col items-center justify-center w-full h-full z-10 p-8 text-center space-y-4">
                  <div className="w-20 h-20 bg-[var(--primary)]/10 rounded-full flex items-center justify-center text-[var(--primary)] group-hover:scale-110 group-hover:bg-[var(--primary)]/20 transition-all">
                    <LucideCamera size={40} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className="block text-[var(--text-primary)] font-black text-xl tracking-tight">Scan Restaurant Menu</span>
                    <p className="text-[var(--text-secondary)] text-sm mt-2 leading-relaxed">Point your camera at a menu to extract metabolic high-value options.</p>
                  </div>
                  <span className="inline-block px-6 py-2 bg-[var(--bg-app)] border border-[var(--border)] rounded-full text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {Capacitor.isNativePlatform() ? "Tap to Launch" : "Select Image"}
                  </span>
                
                {!Capacitor.isNativePlatform() && (
                   <input type="file" accept="image/*" onChange={handleCapture} className="opacity-0 absolute inset-0 cursor-pointer" />
                )}
              </div>
            </motion.div>
        )}

        {analyzing && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="py-20 text-center space-y-6"
            >
                <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 border-4 border-[var(--primary)]/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-[var(--primary)] rounded-full animate-spin" />
                </div>
                <div>
                    <h3 className="font-black text-xl tracking-tight text-[var(--text-primary)]">Analyzing Selections...</h3>
                    <p className="text-[var(--text-secondary)] text-sm font-medium uppercase tracking-[0.2em] mt-1">Cross-referencing BMR</p>
                </div>
            </motion.div>
        )}

        {result && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center px-1">
                <div>
                    <h2 className="text-xl font-black text-[var(--text-primary)]">{result.restaurant_name || 'Extracted Menu'}</h2>
                    <p className="text-[10px] text-[var(--primary)] font-black uppercase tracking-widest mt-1">Optimized Recommendations</p>
                </div>
                <button onClick={() => setResult(null)} className="p-3 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-all">
                  <RefreshCw size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {result.items?.map((item: any, idx: number) => (
                  <div key={idx} className="bg-[var(--bg-surface)] border border-[var(--border)] p-5 rounded-[28px] shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 pr-4">
                        <span className="font-black text-[var(--text-primary)] text-lg leading-tight block truncate">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                             <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${item.health_score >= 8 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[var(--primary)]/10 text-[var(--primary)]'}`}>
                                Score: {item.health_score}/10
                             </div>
                             <span className="text-[10px] font-bold text-[var(--text-secondary)] tabular-nums">{item.estimated_calories} kcal</span>
                        </div>
                      </div>
                      <div className="h-10 w-10 bg-[var(--bg-app)] border border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--text-secondary)]">
                         <ChefHat size={18} />
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {item.tags?.map((tag: string) => (
                        <span key={tag} className="px-3 py-1 bg-[var(--bg-app)] border border-[var(--border)] text-[var(--text-secondary)] text-[9px] font-black uppercase tracking-tight rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/10 p-5 rounded-[32px] space-y-2">
                <div className="flex items-center gap-2 text-[var(--primary)]">
                    <Sparkles size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Metabolic Strategy</span>
                </div>
                <p className="text-xs text-[var(--text-primary)] opacity-80 leading-relaxed font-medium italic">
                    {result.dietary_warnings?.join(', ') || 'Your current metabolic alignment supports all detected options.'}
                </p>
              </div>

              <button 
                onClick={() => setResult(null)} 
                className="w-full h-14 bg-[var(--primary)] text-white rounded-[24px] font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all"
              >
                Scan Another Menu
              </button>
            </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
