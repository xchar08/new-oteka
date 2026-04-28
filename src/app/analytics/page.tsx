'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, TrendingUp, Calendar, Target, Flame, Zap, Droplets, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import { useRouter } from 'next/navigation';
import { useDashboardData } from '@/lib/hooks/useDashboardData';

type WeeklyStats = {
  protein_avg: number;
  carbs_avg: number;
  fats_avg: number;
  total_calories: number;
  log_count: number;
  protein_total: number;
  carbs_total: number;
  fats_total: number;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 100 }
  }
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);
  const supabase = createClient();
  const router = useRouter();
  const { user } = useDashboardData();

  useEffect(() => {
    loadMetrics();
  }, [timeRange, user]);

  async function loadMetrics() {
    if (!user) return;
    setLoading(true);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);

    const { data: logs, error } = await supabase
      .from('logs')
      .select('grams, metabolic_tags_json')
      .eq('user_id', user.id)
      .gte('captured_at', startDate.toISOString());

    if (error || !logs) {
      console.error("Analytics Load Error", error);
      setLoading(false);
      return;
    }

    let p = 0, c = 0, f = 0, cal = 0;
    
    logs.forEach((log: any) => {
      const macros = log.metabolic_tags_json || {}; 
      p += Number(macros.protein || 0);
      c += Number(macros.carbs || 0);
      f += Number(macros.fats || macros.fat || 0);
      cal += Number(macros.calories || 0);
    });

    const windowSize = timeRange;
    
    setStats({
      protein_avg: Math.round(p / windowSize),
      carbs_avg: Math.round(c / windowSize),
      fats_avg: Math.round(f / windowSize),
      total_calories: Math.round(cal / windowSize),
      log_count: logs.length,
      protein_total: Math.round(p),
      carbs_total: Math.round(c),
      fats_total: Math.round(f)
    });
    setLoading(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        <span className="text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-widest">Calculating trends...</span>
      </div>
    </div>
  );

  const targets = {
    calories: user?.metabolic_state_json?.bmr || 2100,
    protein: user?.metabolic_state_json?.protein_target || 140,
    carbs: user?.metabolic_state_json?.carbs_target || 180,
    fats: user?.metabolic_state_json?.fats_target || 65
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] pb-32 font-sans overflow-x-hidden transition-colors duration-500">
      {/* Top App Bar */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-6 pt-8 pb-4 flex items-center gap-4 bg-[var(--bg-app)]/80 backdrop-blur-md sticky top-0 z-40"
      >
        <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-black tracking-tight">Insights</h1>
      </motion.header>

      <main className="px-6 py-6 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-secondary)] mb-1">Metabolic Trends</h2>
            <p className="text-sm text-[var(--text-primary)] opacity-60 font-medium">Trajectory over {timeRange} days.</p>
          </div>
          <div className="flex gap-1 bg-[var(--bg-surface)] p-1 rounded-xl shadow-sm border border-[var(--border)]">
            {[7, 14, 30].map(days => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${timeRange === days ? 'bg-[var(--primary)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {/* Hero Stats */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-4 relative z-10"
        >
          <motion.div 
            variants={itemVariants}
            className="bg-[var(--bg-surface)] p-6 rounded-[32px] border border-[var(--border)] shadow-sm"
          >
            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-widest mb-3">
              <Flame size={12} className="text-[var(--primary)]" />
              <span>Daily Avg</span>
            </div>
            <div className="text-3xl font-black text-[var(--text-primary)]">{stats?.total_calories || 0}</div>
            <div className="text-[10px] font-bold text-[var(--text-secondary)] opacity-50 uppercase mt-1">kcal / day</div>
          </motion.div>
          
          <motion.div 
            variants={itemVariants}
            className="bg-[var(--bg-surface)] p-6 rounded-[32px] border border-[var(--border)] shadow-sm"
          >
            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-widest mb-3">
              <Calendar size={12} className="text-[var(--primary)]" />
              <span>Samples</span>
            </div>
            <div className="text-3xl font-black text-[var(--text-primary)]">{stats?.log_count || 0}</div>
            <div className="text-[10px] font-bold text-[var(--text-secondary)] opacity-50 uppercase mt-1">tracked items</div>
          </motion.div>
        </motion.div>

        {/* Macro Distribution */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--bg-surface)] rounded-[40px] p-8 shadow-sm border border-[var(--border)] relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">Macro Balance</h3>
            <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-widest">{timeRange} Day Mean</span>
          </div>
          
          {stats && stats.log_count > 0 ? (
            <div className="space-y-6 relative z-10">
              {[
                { label: 'Protein', current: stats.protein_avg, target: targets.protein, icon: Zap },
                { label: 'Carbs', current: stats.carbs_avg, target: targets.carbs, icon: Flame },
                { label: 'Fats', current: stats.fats_avg, target: targets.fats, icon: Droplets },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <m.icon size={12} className="text-[var(--primary)]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">{m.label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">{m.current}g <span className="text-[var(--text-secondary)] opacity-40">/ {m.target}g</span></span>
                  </div>
                  <div className="h-2 bg-[var(--bg-app)] rounded-full overflow-hidden border border-[var(--border)]">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((m.current / m.target) * 100, 100)}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="h-full bg-[var(--primary)] rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--text-secondary)]">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-10" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Awaiting solar data...</p>
            </div>
          )}
        </motion.div>

        {/* Total Accumulation Card */}
        {stats && stats.log_count > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--secondary)] rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl"
          >
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-[var(--primary)]/20 rounded-full blur-3xl" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--primary)] mb-6">Total Interval Intake</h3>
            <div className="grid grid-cols-3 gap-4 relative z-10">
              <div className="text-center">
                <div className="text-xl font-black">{stats.protein_total}g</div>
                <div className="text-[8px] font-bold uppercase text-gray-400 mt-1">Protein</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black">{stats.carbs_total}g</div>
                <div className="text-[8px] font-bold uppercase text-gray-400 mt-1">Carbs</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black">{stats.fats_total}g</div>
                <div className="text-[8px] font-bold uppercase text-gray-400 mt-1">Fats</div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
