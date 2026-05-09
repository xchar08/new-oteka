'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MealRating } from '@/components/viz/MealRating';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Zap, Sparkles, CheckCircle2, Clock, AlertTriangle, HeartPulse, ShieldAlert } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import { toast } from 'sonner';

export default function RatingPage() {
  const [taste, setTaste] = useState(0);
  const [digestion, setDigestion] = useState(0);
  const [satiety, setSatiety] = useState(0);
  const [lastLogId, setLastLogId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mealName, setMealName] = useState('');
  const [timeDiffMins, setTimeDiffMins] = useState<number>(0);
  const [isAlreadyRated, setIsAlreadyRated] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function findLog() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('logs')
        .select('id, captured_at, metabolic_tags_json')
        .eq('user_id', user.id)
        .order('captured_at', { ascending: false })
        .limit(1)
        .single();
        
      if (data) {
        const tags = data.metabolic_tags_json as any;
        setMealName(tags?.food_name || tags?.item || 'Latest Meal');
        
        const mealTime = new Date(data.captured_at).getTime();
        const diffMins = Math.floor((Date.now() - mealTime) / 60000);
        setTimeDiffMins(diffMins);
        
        if (tags?.user_score || tags?.feedback) {
          setIsAlreadyRated(true);
        } else {
          setLastLogId(data.id);
        }
      }
      setLoading(false);
    }
    findLog();
  }, []);

  const submitRating = async () => {
    if (!lastLogId || taste === 0 || digestion === 0 || satiety === 0) return;
    setSubmitting(true);

    try {
      const { data: current } = await supabase.from('logs').select('metabolic_tags_json').eq('id', lastLogId).single();
      
      const overallRating = Math.round((taste + digestion + satiety) / 3);
      const newTags = { 
        ...(current?.metabolic_tags_json as object), 
        user_score: overallRating,
        feedback: {
          taste,
          digestion,
          satiety
        }
      };
      
      await supabase
        .from('logs')
        .update({ metabolic_tags_json: newTags })
        .eq('id', lastLogId);

      toast.success("Energy calibration updated successfully!");
      router.push('/dashboard'); 
    } catch (err) {
      console.error(err);
      toast.error("Failed to update neural weights.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
    </div>
  );

  // Screen A: Already rated or no unrated logs found
  if (isAlreadyRated || !lastLogId) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] p-6 flex flex-col items-center justify-center text-center space-y-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-[var(--primary)]/10 rounded-[32px] flex items-center justify-center text-[var(--primary)] shadow-inner"
        >
            <CheckCircle2 size={40} />
        </motion.div>
        <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Calibration Synced</h1>
            <p className="text-[var(--text-secondary)] text-sm font-medium mt-2 max-w-xs mx-auto">
              All recent meals have been fully calibrated with your metabolic signature.
            </p>
        </div>
        <button 
            onClick={() => router.push('/dashboard')}
            className="px-10 py-4 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all"
        >
            Back to Hub
        </button>
      </div>
    );
  }

  // Screen B: Digestion Countdown (Too early - under 30 minutes)
  if (timeDiffMins < 30) {
    const minsRemaining = 30 - timeDiffMins;
    return (
      <div className="min-h-screen bg-[var(--bg-app)] p-6 pb-32 flex flex-col justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto w-full space-y-8 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-black uppercase tracking-widest border border-[var(--primary)]/10">
              <Clock size={12} className="animate-pulse" />
              Nutrient Ingestion Active
          </div>
          
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-8 shadow-sm space-y-6 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1.5 bg-[var(--border)]">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(timeDiffMins / 30) * 100}%` }}
                  className="h-full bg-[var(--primary)]"
                />
             </div>
             
             <div className="w-16 h-16 bg-[var(--primary)]/10 text-[var(--primary)] rounded-2xl flex items-center justify-center mx-auto">
                <HeartPulse size={32} className="animate-pulse" />
             </div>
             
             <div className="space-y-2">
                <h2 className="text-xl font-black tracking-tight text-[var(--text-primary)]">Calibration opens in {minsRemaining}m</h2>
                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed max-w-xs mx-auto">
                  Your body is digesting <span className="text-[var(--primary)] font-black capitalize">{mealName}</span>. Real-time energy, satiety, and digestion tracking unlocks 30 minutes after logging.
                </p>
             </div>
          </div>
          
          <button 
              onClick={() => router.push('/dashboard')}
              className="w-full h-16 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-2xl font-black uppercase tracking-widest text-xs shadow-sm hover:bg-[var(--bg-surface-2)] active:scale-95 transition-all"
          >
              Back to Hub
          </button>
        </motion.div>
        <BottomNav />
      </div>
    );
  }

  // Screen C: Time Window Expired (Over 3 hours / 180 minutes)
  if (timeDiffMins > 180) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] p-6 pb-32 flex flex-col justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto w-full space-y-8 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--error)]/10 text-[var(--error)] text-[10px] font-black uppercase tracking-widest border border-[var(--error)]/10">
              <AlertTriangle size={12} />
              Calibration Window Expired
          </div>
          
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-8 shadow-sm space-y-6">
             <div className="w-16 h-16 bg-[var(--error)]/10 text-[var(--error)] rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
             </div>
             
             <div className="space-y-2">
                <h2 className="text-xl font-black tracking-tight text-[var(--text-primary)]">Window Closed</h2>
                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed max-w-xs mx-auto">
                  Your meal of <span className="text-[var(--primary)] font-black capitalize">{mealName}</span> was logged {Math.floor(timeDiffMins / 60)}h ago. Assessments must occur within 3 hours to capture high-fidelity biological feedback.
                </p>
             </div>
          </div>
          
          <button 
              onClick={() => router.push('/dashboard')}
              className="w-full h-16 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-2xl font-black uppercase tracking-widest text-xs shadow-sm hover:bg-[var(--bg-surface-2)] active:scale-95 transition-all"
          >
              Back to Hub
          </button>
        </motion.div>
        <BottomNav />
      </div>
    );
  }

  // Screen D: Perfect Window! Display active 3-slider rating panel
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-36 flex flex-col justify-center transition-colors duration-500 font-sans">
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto w-full space-y-8"
      >
        <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-black uppercase tracking-widest border border-[var(--primary)]/10">
                <Sparkles size={12} />
                Energy Calibration
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Calibrate Your Energy</h1>
            <p className="text-[var(--text-secondary)] text-xs font-medium px-4 leading-relaxed">
                Assess how you feel {timeDiffMins} minutes after consuming <span className="text-[var(--primary)] font-black capitalize">{mealName}</span>.
            </p>
        </div>
        
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-6 shadow-sm space-y-6">
            
            {/* 1. Taste */}
            <div className="space-y-2 border-b border-[var(--border)] pb-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">Taste Alignment</span>
                <span className="text-[10px] font-bold text-[var(--primary)]">
                  {taste === 1 && "Poor"}
                  {taste === 2 && "Neutral"}
                  {taste === 3 && "Pleasant"}
                  {taste === 4 && "Delicious"}
                  {taste === 5 && "Extraordinary"}
                  {taste === 0 && "Pending"}
                </span>
              </div>
              <div className="flex justify-center py-2 bg-[var(--bg-app)] border border-[var(--border)]/40 rounded-2xl">
                <MealRating score={taste} onRate={setTaste} size={32} />
              </div>
            </div>

            {/* 2. Digestion */}
            <div className="space-y-2 border-b border-[var(--border)] pb-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">Gut Comfort & Digestion</span>
                <span className="text-[10px] font-bold text-[var(--primary)]">
                  {digestion === 1 && "Sluggish / Bloated"}
                  {digestion === 2 && "Slight Comfort"}
                  {digestion === 3 && "Nominal / Light"}
                  {digestion === 4 && "Active / Fluid"}
                  {digestion === 5 && "Optimal Absorption"}
                  {digestion === 0 && "Pending"}
                </span>
              </div>
              <div className="flex justify-center py-2 bg-[var(--bg-app)] border border-[var(--border)]/40 rounded-2xl">
                <MealRating score={digestion} onRate={setDigestion} size={32} />
              </div>
            </div>

            {/* 3. Satiety & Focus */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">Satiety & Energy Level</span>
                <span className="text-[10px] font-bold text-[var(--primary)]">
                  {satiety === 1 && "Crash / Lethargic"}
                  {satiety === 2 && "Neutral / Balanced"}
                  {satiety === 3 && "Satiated / Stable"}
                  {satiety === 4 && "Energized / Focused"}
                  {satiety === 5 && "Peak Vitality"}
                  {satiety === 0 && "Pending"}
                </span>
              </div>
              <div className="flex justify-center py-2 bg-[var(--bg-app)] border border-[var(--border)]/40 rounded-2xl">
                <MealRating score={satiety} onRate={setSatiety} size={32} />
              </div>
            </div>
        </div>

        <div className="space-y-3">
            <button 
                disabled={taste === 0 || digestion === 0 || satiety === 0 || submitting}
                onClick={submitRating}
                className="w-full h-16 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
            >
                {submitting ? <Sparkles className="animate-spin" size={18} /> : <Zap size={18} />}
                Update Neural Weights
            </button>
            
            <button 
                onClick={() => router.push('/dashboard')}
                className="w-full text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors py-4"
            >
                Skip Assessment
            </button>
        </div>
      </motion.div>

      <BottomNav />
    </div>
  );
}

