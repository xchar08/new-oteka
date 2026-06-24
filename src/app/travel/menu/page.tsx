'use client';

import React, { useState, useEffect } from 'react';
import { Camera as LucideCamera, AlertCircle, RefreshCw, ChevronLeft, Sparkles, ChefHat, Loader2, Zap, Target, Crosshair, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Camera, CameraResultType } from '@capacitor/camera';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import { useUser } from '@/lib/hooks/useUser';
import { visionService } from '@/lib/services/vision.service';
import { useGeolocation, getNearbyPlacesContext } from '@/lib/hooks/useGeolocation';
import { toast } from 'sonner';
import { isPaidPlan } from '@/lib/utils/plan';

export default function MenuScannerPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [mounted, setMounted] = React.useState(false);
  const [targetingId, setTargetingId] = useState<number | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { user } = useUser();
  const isPro = isPaidPlan(user?.plan);
  const geo = useGeolocation();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-request location on mount for restaurant context
  React.useEffect(() => {
    if (mounted && geo.permissionStatus !== 'denied') {
      geo.requestLocation();
    }
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNativeCamera = async () => {
    try {
      setAnalyzing(true);
      setError(null);

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
      });

      if (!image.webPath) throw new Error('Failed to capture image');

      // 1. Convert to Blob and Resize if needed (simplified here, but following storage-first pattern)
      const res = await fetch(image.webPath);
      const blob = await res.blob();

      if (!user) throw new Error('User session required');

      // 2. Upload to Storage
      toast.info('Uploading menu data...', { duration: 2000 });
      const { path } = await visionService.uploadScan(user.id, blob);

      // 2b. Gap 3: Fetch nearby restaurant context if location available
      let locationContext = '';
      if (geo.hasLocation && geo.latitude && geo.longitude) {
        locationContext = await getNearbyPlacesContext(geo.latitude, geo.longitude);
      }

      // 3. Invoke Edge Function with Path + Location Context
      const { data, error: functionError } = await supabase.functions.invoke('vision-menu', {
        body: { 
          imagePath: path, 
          goal: user?.metabolic_state_json?.current_goal || 'maintenance',
          location_context: locationContext || undefined,
          latitude: geo.latitude || undefined,
          longitude: geo.longitude || undefined,
        },
      });

      if (functionError) {
        console.error('[Vision Menu] Function Invoke Error:', functionError);
        
        let detail = functionError.message;
        // Supabase FunctionsHttpError contains a 'context' which is the Response object
        if ((functionError as any).context) {
          try {
            const ctx = (functionError as any).context;
            const errBody = await ctx.json();
            detail = `${errBody.error}: ${errBody.details || ''} ${JSON.stringify(errBody.debug_auth || {})}`;
          } catch (e) {
            console.error('[Vision Menu] Could not parse error body:', e);
          }
        }
        throw new Error(`[${functionError.name || 'Error'}] ${detail}`);
      }
      setResult(data);
    } catch (e: any) {
      console.error('Menu Scan Failed:', e);
      const errorMessage = e.message || 'Optical analysis failed. Check neural link.';
      setError(errorMessage);
      toast.error('Scan Failed: ' + errorMessage);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTargetMeal = async (item: any, index: number) => {
    if (!user) return;
    try {
      setTargetingId(index);
      
      const { error: logError } = await supabase.from('logs').insert({
        user_id: user.id,
        grams: 0, // Volumetric data unknown for planned items
        local_date: new Date().toLocaleDateString('en-CA'),
        metabolic_tags_json: {
          ...item,
          food_name: item.name,
          status: 'planned',
          source: 'menu_scanner_v1',
          calories: item.estimated_calories
        }
      });

      if (logError) throw logError;

      toast.success(`${item.name} synchronized with Daily Cycle.`, {
        icon: <Target className="text-[var(--primary)]" size={16} />
      });
      
      // Navigate to history to see the planned item
      setTimeout(() => router.push('/history'), 1200);
      
    } catch (e: any) {
      console.error('Targeting Failed:', e);
      toast.error("Metabolic lock failed.");
    } finally {
      setTargetingId(null);
    }
  };

  if (!mounted) return null;

  return (
    <div className={`min-h-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-500`}>
      
      {/* Header */}
      <header className={`px-6 pt-safe pb-4 bg-[var(--bg-app)]/80 backdrop-blur-md sticky top-0 z-40 border-b border-[var(--border)]`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
                onClick={() => router.back()}
                className={`p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors`}
            >
                <ChevronLeft size={24} />
            </button>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary)]/10 text-[var(--primary)]`}>
              <LucideCamera size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">{isPro ? 'Neural Menu Decoder' : 'Menu Scanner'}</h1>
              <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5 text-[var(--primary)]`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse bg-[var(--primary)]`} />
                {isPro ? 'Priority Vision Active' : 'Standard Optical Core'}
                {geo.hasLocation && (
                  <span className="ml-2 text-emerald-500 text-[8px]">• GPS Locked</span>
                )}
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
                <div className={`w-32 h-32 rounded-[40px] flex items-center justify-center relative z-10 bg-[var(--bg-surface)] shadow-xl border border-[var(--border)]`}>
                  <LucideCamera size={48} className={`text-[var(--primary)]`} />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-black">Ready for Acquisition</h2>
                <p className={`text-sm max-w-xs mx-auto text-[var(--text-secondary)] opacity-80`}>
                  Position the menu clearly in frame for high-fidelity metabolic breakdown.
                </p>
              </div>

              <button
                onClick={handleNativeCamera}
                className={`w-full max-w-xs h-16 rounded-[24px] font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 bg-[var(--primary)] text-white`}
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
                    <Loader2 className={`h-16 w-16 animate-spin text-[var(--primary)]`} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Zap size={20} className={`text-[var(--primary)]`} />
                    </div>
               </div>
               <div className="space-y-1 text-center">
                    <p className={`text-xs font-black uppercase tracking-[0.3em] animate-pulse text-[var(--primary)]`}>
                        Analyzing Optical Data
                    </p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]`}>
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
              <div className={`p-6 rounded-[32px] border bg-[var(--bg-surface)] border-[var(--border)] shadow-sm`}>
                <div className="flex items-center gap-3 mb-6 border-b border-[var(--border)] pb-4">
                  <ChefHat size={22} className="text-[var(--primary)]" />
                  <div>
                    <h3 className="text-lg font-black tracking-tight">
                        {result.restaurant_name || 'Detected Node'}
                    </h3>
                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--primary)] opacity-60">Metabolic Logic Applied</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {result.items?.map((item: any, i: number) => {
                    const impactColors: Record<string, string> = {
                      'super_good': 'bg-green-500/20 text-green-500 border-green-500/30',
                      'good': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                      'neutral': 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)]',
                      'bad': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
                      'super_bad': 'bg-red-500/20 text-red-500 border-red-500/30',
                    };

                    const impact = item.metabolic_impact || 'neutral';
                    const colorClass = impactColors[impact] || impactColors.neutral;
                    const isMedicalConflict = item.health_score <= 1;

                    return (
                      <motion.div 
                          key={i} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={`p-5 rounded-[2.5rem] border ${isMedicalConflict ? 'bg-red-500/5 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-[var(--bg-surface-2)] border-[var(--border)]'} relative overflow-hidden group`}
                      >
                          {isMedicalConflict && (
                            <div className="absolute top-0 right-0 px-4 py-1.5 bg-red-500 text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-bl-2xl flex items-center gap-1.5 shadow-lg">
                                <AlertCircle size={10} fill="white" className="text-red-500" />
                                Medical Conflict
                            </div>
                          )}

                          <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <span className={`font-black text-sm pr-4 block ${isMedicalConflict ? 'text-red-500' : ''}`}>{item.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${colorClass}`}>
                                        {impact.replace('_', ' ')}
                                    </div>
                                    <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40">{item.estimated_calories} kcal</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-center shrink-0">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-[var(--primary)]/20`}>
                                    <span className="font-black text-[var(--primary)] text-sm">{item.health_score}</span>
                                </div>
                                <span className="text-[7px] font-black uppercase tracking-widest text-[var(--text-secondary)] mt-1 opacity-40">Score</span>
                              </div>
                          </div>
                          
                          <p className={`text-[10px] leading-relaxed mb-4 text-[var(--text-secondary)] opacity-80 italic`}>{item.layman_explanation || item.description}</p>
                          
                          <div className="flex flex-wrap gap-2 mb-6">
                              {item.tags?.map((t: string) => (
                                  <span key={t} className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] opacity-60`}>
                                      {t}
                                  </span>
                              ))}
                          </div>

                          {/* TARGET MEAL ACTION */}
                          <motion.button 
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleTargetMeal(item, i)}
                              disabled={targetingId !== null}
                              className={`w-full py-3.5 rounded-2xl font-black uppercase tracking-[0.25em] text-[9px] flex items-center justify-center gap-2.5 transition-all shadow-lg ${
                                  targetingId === i 
                                  ? 'bg-[var(--text-secondary)] text-white cursor-wait opacity-50'
                                  : 'bg-[var(--primary)] text-white shadow-[var(--primary)]/20'
                              }`}
                          >
                              {targetingId === i ? (
                                  <Loader2 size={14} className="animate-spin" />
                              ) : (
                                  <Crosshair size={14} strokeWidth={3} />
                              )}
                              {targetingId === i ? 'Locking Node...' : 'Target This Meal'}
                          </motion.button>
                      </motion.div>
                    );
                  })}
                </div>

                <button 
                  onClick={() => setResult(null)}
                  className={`w-full mt-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border transition-all active:scale-95 border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]`}
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
