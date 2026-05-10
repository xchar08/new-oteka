'use client';

import React, { useState, useEffect } from 'react';
import { Camera as LucideCamera, AlertCircle, RefreshCw, ChevronLeft, Sparkles, ChefHat, Loader2, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Camera, CameraResultType } from '@capacitor/camera';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import { useDashboardData } from '@/lib/hooks/useDashboardData';

export default function MenuScannerPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { user } = useDashboardData();
  const isPro = user?.plan === 'pro';

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleNativeCamera = async () => {
    try {
      setAnalyzing(true);
      setError(null);

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
      });

      if (image.base64String) {
        const { data, error: functionError } = await supabase.functions.invoke('vision-menu', {
          body: { image: image.base64String, goal: user?.metabolic_state_json?.current_goal || 'maintenance' },
        });

        if (functionError) throw functionError;
        setResult(data);
      }
    } catch (e: any) {
      console.error('Menu Scan Failed:', e);
      setError(e.message || 'Optical analysis failed. Check neural link.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 ${isPro ? 'theme-solar dark bg-[var(--bg-app)] text-white' : 'bg-[var(--bg-app)] text-[var(--text-primary)]'}`}>
      
      {/* Header */}
      <header className={`px-6 pt-safe pb-4 backdrop-blur-md sticky top-0 z-40 border-b ${isPro ? 'bg-[var(--bg-app)]/80 border-white/5' : 'bg-[var(--bg-app)]/80 border-[var(--border)]'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
                onClick={() => router.back()}
                className={`p-2 -ml-2 rounded-full transition-colors ${isPro ? 'hover:bg-white/10 text-white/40' : 'hover:bg-black/5 text-[var(--text-secondary)]'}`}
            >
                <ChevronLeft size={24} />
            </button>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPro ? 'bg-[var(--primary)] text-black' : 'bg-[var(--primary)]/10 text-[var(--primary)]'}`}>
              <LucideCamera size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">{isPro ? 'Neural Menu Decoder' : 'Menu Scanner'}</h1>
              <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5 ${isPro ? 'text-[var(--primary)]' : 'text-[var(--primary)]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isPro ? 'bg-[var(--primary)] shadow-[0_0_8px_var(--primary)]' : 'bg-[var(--primary)]'}`} />
                {isPro ? 'Priority Vision Active' : 'Standard Optical Core'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 pb-32">
        <AnimatePresence mode="wait">
          {!result && !analyzing && (
            <motion.div 
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center h-full text-center space-y-8"
            >
              <div className="relative">
                <div className={`w-32 h-32 rounded-[40px] flex items-center justify-center relative z-10 ${isPro ? 'bg-white/5 border border-white/10 shadow-2xl' : 'bg-[var(--bg-surface)] shadow-xl border border-[var(--border)]'}`}>
                  <LucideCamera size={48} className={isPro ? 'text-[var(--primary)]' : 'text-[var(--primary)]'} />
                </div>
                {isPro && (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-4 bg-gradient-to-tr from-[var(--primary)] to-transparent rounded-[48px] opacity-20 blur-md"
                  />
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-black">Ready for Acquisition</h2>
                <p className={`text-sm max-w-xs mx-auto ${isPro ? 'text-white/40' : 'text-[var(--text-secondary)] opacity-80'}`}>
                  Position the menu clearly in frame for high-fidelity metabolic breakdown.
                </p>
              </div>

              <button
                onClick={handleNativeCamera}
                className={`w-full max-w-xs h-16 rounded-[24px] font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isPro ? 'bg-[var(--primary)] text-black' : 'bg-[var(--primary)] text-white'}`}
              >
                Launch Scanner
                <Sparkles size={18} />
              </button>
            </motion.div>
          )}

          {analyzing && (
            <motion.div 
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full space-y-6"
            >
               <div className="relative">
                    <Loader2 className={`h-16 w-16 animate-spin ${isPro ? 'text-[var(--primary)]' : 'text-[var(--primary)]'}`} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Zap size={20} className={isPro ? 'text-[var(--primary)]' : 'text-[var(--primary)]'} />
                    </div>
               </div>
               <div className="space-y-1 text-center">
                    <p className={`text-xs font-black uppercase tracking-[0.3em] animate-pulse ${isPro ? 'text-[var(--primary)]' : 'text-[var(--primary)]'}`}>
                        Analyzing Optical Data
                    </p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${isPro ? 'text-white/40' : 'text-[var(--text-secondary)]'}`}>
                        Synthesizing metabolic matches...
                    </p>
               </div>
            </motion.div>
          )}

          {result && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className={`p-6 rounded-[32px] border ${isPro ? 'bg-white/5 border-white/10' : 'bg-[var(--bg-surface)] border-[var(--border)] shadow-sm'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <ChefHat size={20} className="text-[var(--primary)]" />
                  <h3 className="text-lg font-black tracking-tight">
                    {result.restaurant_name || 'Detected Node'}
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {result.items?.map((item: any, i: number) => (
                    <div key={i} className={`p-4 rounded-2xl border ${isPro ? 'bg-black/40 border-white/5' : 'bg-[var(--bg-surface-2)] border-[var(--border)]'}`}>
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-black text-sm">{item.name}</span>
                            <span className="text-[var(--primary)] font-black text-xs font-mono">{item.estimated_calories} kcal</span>
                        </div>
                        <p className={`text-[10px] leading-relaxed mb-3 ${isPro ? 'text-white/40' : 'text-[var(--text-secondary)] opacity-80'}`}>{item.description}</p>
                        <div className="flex flex-wrap gap-2">
                            {item.tags?.map((t: string) => (
                                <span key={t} className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${isPro ? 'bg-white/5 text-white/40 border-white/5' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)]'}`}>
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setResult(null)}
                  className={`w-full mt-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border transition-all active:scale-95 ${isPro ? 'border-white/10 text-white/60 hover:bg-white/5' : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]'}`}
                >
                  Scan Another Menu
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {error && (
        <div className="px-6 pb-24">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
                <AlertCircle size={20} />
                <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-500/10 rounded-lg">
                    <RefreshCw size={14} />
                </button>
            </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
