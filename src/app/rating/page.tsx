'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MealRating } from '@/components/viz/MealRating';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ChevronLeft, Zap, Sparkles, CheckCircle2 } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

export default function RatingPage() {
  const [rating, setRating] = useState(0);
  const [lastLogId, setLastLogId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mealName, setMealName] = useState('');
  
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
        if (!tags?.user_score) {
           setLastLogId(data.id);
        }
      }
      setLoading(false);
    }
    findLog();
  }, []);

  const submitRating = async () => {
    if (!lastLogId || rating === 0) return;
    setSubmitting(true);

    const { data: current } = await supabase.from('logs').select('metabolic_tags_json').eq('id', lastLogId).single();
    const newTags = { ...(current?.metabolic_tags_json as object), user_score: rating };
    
    await supabase
      .from('logs')
      .update({ metabolic_tags_json: newTags })
      .eq('id', lastLogId);

    setSubmitting(false);
    router.push('/dashboard'); 
  };

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
    </div>
  );

  if (!lastLogId) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] p-6 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-20 h-20 bg-[var(--primary)]/10 rounded-[32px] flex items-center justify-center text-[var(--primary)]">
            <CheckCircle2 size={40} />
        </div>
        <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Sync Complete</h1>
            <p className="text-[var(--text-secondary)] text-sm font-medium mt-2">All recent meals have been analyzed and rated.</p>
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

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 flex flex-col justify-center transition-colors duration-500 font-sans">
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto w-full space-y-10"
      >
        <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-black uppercase tracking-widest border border-[var(--primary)]/10">
                <Sparkles size={12} />
                Energy Calibration
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">How do you feel?</h1>
            <p className="text-[var(--text-secondary)] text-sm font-medium px-4">
                Rate your energy, focus, and digestion after consuming <span className="text-[var(--primary)] font-black capitalize">{mealName}</span>.
            </p>
        </div>
        
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-10 shadow-sm flex flex-col items-center gap-8">
            <MealRating score={rating} onRate={setRating} size={48} />
            
            <div className="text-center h-10 flex items-center justify-center px-4 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border)]">
               <span className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)]">
                {rating === 1 && "Low Energy / Sluggish"}
                {rating === 2 && "Neutral / Balanced"}
                {rating === 3 && "Good / Focused"}
                {rating === 4 && "Optimal Performance"}
                {rating === 5 && "Peak Human Baseline"}
                {rating === 0 && "Select a Vitality Score"}
               </span>
            </div>
        </div>

        <div className="space-y-4">
            <button 
                disabled={rating === 0 || submitting}
                onClick={submitRating}
                className="w-full h-16 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
            >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
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

function Loader2({ className, size }: { className?: string; size?: number }) {
    return <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className={className}><Sparkles size={size} /></motion.div>
}
