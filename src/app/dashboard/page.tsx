'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Camera, ShoppingCart as ShoppingCartIcon, Sparkles, Flame, Target, 
  Activity as ActivityIcon, Zap, Droplets, ChevronRight, User, 
  Settings, Bell, Clock, Crown, Calendar, Utensils, Plus
} from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import { useRouter } from 'next/navigation';
import { useConnectionMode } from '@/lib/hooks/useConnectionMode';
import { useUser } from '@/lib/hooks/useUser';
import { useMetabolicLogs } from '@/lib/hooks/useMetabolicLogs';
import { PricingGuard } from '@/components/ui/PricingGuard';
import { createClient } from '@/lib/supabase/client';

import { LogEntryCard } from '@/components/pantry/LogEntryCard';
import { aggregateNutrients, extractLogStats } from '@/lib/utils/metabolic.utils';
import { NutrientInfoModal } from '@/components/ui/NutrientInfoModal';
import type { LogEntry } from '@/lib/types/metabolic';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
};

export default function DashboardPage() {
  useConnectionMode();
  const { user, loading: userLoading } = useUser();
  const { dailyMacros, advice, dailyLogs = [], loading: logsLoading } = useMetabolicLogs();
  const loading = userLoading || logsLoading;
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'hub' | 'logs' | 'insights'>('hub');
  
  // -- Logs State --
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedNutrient, setSelectedNutrient] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const today = new Date();
  const weekDates = useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
        d.setDate(diff + i);
        return {
          fullDate: new Date(d),
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          date: d.getDate().toString(),
        };
      });
  }, [mounted, today]);

  const selectedDateString = mounted ? selectedDate.toLocaleDateString('en-CA') : '';
  const filteredLogs = useMemo(() => {
    return (dailyLogs as LogEntry[]).filter((log) => log.local_date === selectedDateString);
  }, [dailyLogs, selectedDateString]);

  const filteredMacros = useMemo(() => {
    return filteredLogs.reduce((acc, log) => {
      const s = extractLogStats(log);
      return {
        calories: acc.calories + s.calories,
        protein: acc.protein + s.protein,
        carbs: acc.carbs + s.carbs,
        fats: acc.fats + s.fat,
        fiber: acc.fiber + s.fiber,
        sugar: acc.sugar + s.sugar,
        sodium: acc.sodium + s.sodium,
        cholesterol: acc.cholesterol + s.cholesterol,
        vitamins: aggregateNutrients(acc.vitamins || {}, s.vitamins),
        minerals: aggregateNutrients(acc.minerals || {}, s.minerals),
      };
    }, { 
      calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0,
      vitamins: {} as Record<string, any>, minerals: {} as Record<string, any>
    });
  }, [filteredLogs]);

  // -- Insights State --
  const [timeRange, setTimeRange] = useState(7);
  const [stats, setStats] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    async function loadMetrics() {
      if (!user || activeTab !== 'insights') return;
      setInsightsLoading(true);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeRange);
      
      const { data: logs, error } = await supabase
        .from('logs')
        .select('grams, metabolic_tags_json')
        .eq('user_id', user.id)
        .gte('local_date', startDate.toLocaleDateString('en-CA'));

      if (error || !logs) {
        setInsightsLoading(false);
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

      setStats({
        protein_avg: Math.round(p / timeRange),
        carbs_avg: Math.round(c / timeRange),
        fats_avg: Math.round(f / timeRange),
        total_calories: Math.round(cal / timeRange),
        log_count: logs.length,
        protein_total: Math.round(p),
        carbs_total: Math.round(c),
        fats_total: Math.round(f)
      });
      setInsightsLoading(false);
    }
    loadMetrics();
  }, [timeRange, user, activeTab, supabase]);

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
    </div>
  );

  const meta = user?.metabolic_state_json || {};
  const calorieGoal = user?.calorie_target || 2000;
  const proteinTarget = meta.protein_target || 140;
  const carbsTarget = meta.carbs_target || 180;
  const fatsTarget = meta.fats_target || 65;
  const isPro = user?.plan === 'pro';

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] pb-32 font-sans overflow-x-hidden transition-colors">
      
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-6 pt-12 pb-4 bg-[var(--bg-app)]/80 backdrop-blur-xl sticky top-0 z-40 border-b border-[var(--border)]"
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <motion.h1 className="text-3xl font-black tracking-tight">
              Oteka <span className="text-[var(--primary)]">Command</span>
            </motion.h1>
            <div className="flex items-center gap-3 mt-4">
               <motion.div className="flex items-center gap-1.5 text-[var(--primary)] font-bold bg-[var(--bg-surface)] px-3 py-1.5 rounded-xl shadow-sm border border-[var(--primary)]/10">
                 <Flame size={14} fill="currentColor" />
                 <span className="text-[9px] uppercase tracking-widest">{user?.streak_count || 0} Day Streak</span>
               </motion.div>
               {isPro && (
                  <motion.div className="flex items-center gap-1.5 text-[var(--primary)] font-black bg-[var(--primary)]/10 px-3 py-1.5 rounded-xl shadow-sm border border-[var(--primary)]/20">
                    <Crown size={12} fill="currentColor" />
                    <span className="text-[9px] uppercase tracking-widest">Solar Active</span>
                  </motion.div>
               )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                onClick={() => router.push('/settings')}
                className="w-12 h-12 bg-[var(--bg-surface)] rounded-2xl flex items-center justify-center shadow-xl shadow-[var(--primary)]/10 border border-[var(--primary)]/5 text-[var(--text-secondary)]"
            >
                <Settings size={22} />
            </motion.button>
            <motion.div 
                onClick={() => router.push('/profile')}
                whileHover={{ scale: 1.1 }}
                className="w-12 h-12 bg-[var(--bg-surface)] rounded-2xl flex items-center justify-center shadow-xl shadow-[var(--primary)]/10 border border-[var(--primary)]/5 overflow-hidden cursor-pointer"
            >
                {user?.avatar_url ? <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" /> : <User size={22} className="text-[var(--primary)]" />}
            </motion.div>
          </div>
        </div>

        {/* Unified Tab Bar */}
        <div className="flex bg-[var(--bg-surface)] p-1 rounded-2xl border border-[var(--border)] relative">
          {['hub', 'logs', 'insights'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 relative py-3 text-[10px] font-black uppercase tracking-widest z-10 transition-colors ${activeTab === tab ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              {activeTab === tab && (
                <motion.div 
                  layoutId="active-dashboard-tab"
                  className="absolute inset-0 bg-[var(--primary)] rounded-xl -z-10 shadow-md shadow-[var(--primary)]/20"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              {tab}
            </button>
          ))}
        </div>
      </motion.header>

      <main className="px-6 mt-6 pb-20">
        <AnimatePresence mode="wait">
          
          {/* HUB TAB */}
          {activeTab === 'hub' && (
            <motion.div key="hub" variants={container} initial="hidden" animate="show" exit={{ opacity: 0, y: -10 }} className="space-y-6">
              
              {/* Calibration Banner */}
              {(() => {
                const latestUnratedLog = dailyLogs.find(l => {
                  const tags = l.metabolic_tags_json as any;
                  return !tags?.user_score && !tags?.feedback;
                });
                if (!latestUnratedLog) return null;
                const mealTime = new Date(latestUnratedLog.captured_at).getTime();
                const diffMins = Math.floor((Date.now() - mealTime) / 60000);
                const mealName = latestUnratedLog.metabolic_tags_json?.food_name || latestUnratedLog.metabolic_tags_json?.item || 'Latest Meal';
                if (diffMins >= 0 && diffMins < 30) {
                  return (
                    <motion.div variants={item} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[28px] p-4 flex items-center justify-between shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 h-1 bg-[var(--primary)]/30 w-full">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(diffMins / 30) * 100}%` }} className="h-full bg-[var(--primary)]" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)] animate-pulse">
                          <Clock size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">Digesting {mealName}</h4>
                          <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-0.5">Energy calibration window opens in {30 - diffMins}m</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                }
                if (diffMins >= 30 && diffMins <= 180) {
                  return (
                    <motion.div variants={item} whileHover={{ scale: 1.02 }} onClick={() => router.push('/rating')} className="bg-gradient-to-r from-[var(--primary)]/20 to-[var(--primary)]/5 border border-[var(--primary)]/30 rounded-[32px] p-5 shadow-lg shadow-[var(--primary)]/5 cursor-pointer relative overflow-hidden group">
                      <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--primary)]/10 rounded-full blur-2xl group-hover:bg-[var(--primary)]/25 transition-all" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center shadow-md shadow-[var(--primary)]/20">
                            <Zap size={22} fill="currentColor" />
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--primary)]">Post-Meal Calibration Active</span>
                            <h4 className="text-sm font-black text-[var(--text-primary)] mt-1">Calibrate {mealName}</h4>
                            <p className="text-[10px] text-[var(--text-secondary)] font-bold mt-0.5">{diffMins}m elapsed • How is your energy & digestion?</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-[var(--primary)] group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.div>
                  );
                }
                return null;
              })()}

              <motion.div variants={item} className="bg-[var(--bg-surface)] rounded-[32px] p-6 shadow-sm border border-[var(--border)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Sparkles size={80} strokeWidth={1} /></div>
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]"><Sparkles size={14} /></div>
                  <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-[0.2em]">Metabolic Advisor</span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--text-primary)] opacity-80 relative z-10 font-medium italic">"{advice || "Analyzing your metabolic alignment..."}"</p>
              </motion.div>

              <motion.div variants={item} className="bg-[var(--bg-surface)] rounded-[40px] p-8 shadow-sm border border-[var(--border)] relative overflow-hidden flex flex-col items-center">
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-3xl" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-50 mb-8">Metabolic Score</h3>
                <div className="relative w-56 h-56 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90">
                      <circle cx="112" cy="112" r="100" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-[var(--bg-app)]" />
                      <motion.circle initial={{ strokeDasharray: "0 628" }} animate={{ strokeDasharray: `${Math.min((dailyMacros.calories / calorieGoal) * 628, 628)} 628` }} transition={{ duration: 2.5, ease: "easeOut", delay: 0.1 }} cx="112" cy="112" r="100" stroke="currentColor" strokeWidth="16" strokeLinecap="round" fill="transparent" className="text-[var(--primary)]" />
                   </svg>
                   <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black text-[var(--text-primary)]">{(user?.streak_count || 0) > 0 ? 88 + (user?.streak_count || 0) : 88}</span>
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Excellent</span>
                   </div>
                </div>
                <div className="mt-8 flex gap-8">
                   <div className="text-center">
                      <p className="text-xl font-black text-[var(--text-primary)]">{dailyMacros.calories.toFixed(0)}</p>
                      <p className="text-[10px] font-bold uppercase text-[var(--text-secondary)] opacity-50 tracking-wider">Consumed</p>
                   </div>
                   <div className="w-px h-8 bg-[var(--border)] self-center" />
                   <div className="text-center">
                      <p className="text-xl font-black text-[var(--text-primary)]">{Math.max(0, calorieGoal - dailyMacros.calories).toFixed(0)}</p>
                      <p className="text-[10px] font-bold uppercase text-[var(--text-secondary)] opacity-50 tracking-wider">Remaining</p>
                   </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-3 gap-3">
                <motion.div variants={item}>
                  <button onClick={() => router.push('/vision')} className="flex flex-col items-center gap-2 group w-full">
                    <motion.div whileHover={{ scale: 1.1, y: -5 }} whileTap={{ scale: 0.9 }} className="w-16 h-16 rounded-[24px] flex items-center justify-center shadow-sm group-hover:shadow-xl transition-all border bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20">
                      <Camera size={24} strokeWidth={2.5} />
                    </motion.div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 transition-opacity">Scan</span>
                  </button>
                </motion.div>
                <motion.div variants={item}>
                  <PricingGuard plan={user?.plan} featureName="Planner">
                    <button onClick={() => router.push('/pantry')} className="flex flex-col items-center gap-2 group w-full">
                      <motion.div whileHover={{ scale: 1.1, y: -5 }} whileTap={{ scale: 0.9 }} className="w-16 h-16 rounded-[24px] border flex items-center justify-center shadow-sm group-hover:shadow-xl transition-all bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20">
                        <Target size={24} strokeWidth={2.5} />
                      </motion.div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 transition-opacity">Plan</span>
                    </button>
                  </PricingGuard>
                </motion.div>
                <motion.div variants={item}>
                  <PricingGuard plan={user?.plan} featureName="Shopping Logistics">
                    <button onClick={() => router.push('/shopping')} className="flex flex-col items-center gap-2 group w-full">
                      <motion.div whileHover={{ scale: 1.1, y: -5 }} whileTap={{ scale: 0.9 }} className="w-16 h-16 rounded-[24px] border flex items-center justify-center shadow-sm group-hover:shadow-xl transition-all bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20">
                        <ShoppingCartIcon size={24} strokeWidth={2.5} />
                      </motion.div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 transition-opacity">Shop</span>
                    </button>
                  </PricingGuard>
                </motion.div>
              </div>

              <motion.div variants={item} className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Protein', value: dailyMacros.protein, target: proteinTarget, icon: Zap },
                    { label: 'Carbs', value: dailyMacros.carbs, target: carbsTarget, icon: Flame },
                    { label: 'Fats', value: dailyMacros.fat, target: fatsTarget, icon: Droplets },
                  ].map((macro) => (
                    <div key={macro.label} className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
                      <div className="flex items-center gap-1.5 mb-2 text-[var(--text-secondary)] opacity-40">
                        <macro.icon size={12} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">{macro.label}</span>
                      </div>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-lg font-black text-[var(--text-primary)]">{macro.value.toFixed(0)}</span>
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-30">/{macro.target}</span>
                      </div>
                      <div className="mt-3 h-1 bg-[var(--bg-app)] rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((macro.value / macro.target) * 100, 100)}%` }} className="h-full bg-[var(--primary)] rounded-full" />
                      </div>
                    </div>
                  ))}
              </motion.div>
            </motion.div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' && (
            <motion.div key="logs" variants={container} initial="hidden" animate="show" exit={{ opacity: 0, y: -10 }} className="space-y-6">
              
              <motion.div variants={item} className="overflow-x-auto scrollbar-hide -mx-6 px-6">
                <div className="flex justify-between min-w-full gap-3">
                  {weekDates.map((d, i) => {
                    const isActive = d.fullDate.getDate() === selectedDate.getDate() && d.fullDate.getMonth() === selectedDate.getMonth();
                    return (
                        <motion.button 
                          key={i} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setSelectedDate(d.fullDate)}
                          className={`flex flex-col items-center justify-center min-w-[54px] py-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/30 scale-110' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] shadow-sm'}`}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest mb-1">{d.day}</span>
                          <span className="text-base font-black">{d.date}</span>
                        </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              <motion.div variants={item} className="bg-[var(--bg-surface)] rounded-[32px] p-6 shadow-sm border border-[var(--border)] flex flex-col items-center">
                 {/* Aggregated Daily Micros Subbar */}
                 <div className="flex justify-between items-center w-full gap-2">
                    {[
                        { label: 'Fiber', val: filteredMacros.fiber, unit: 'g', name: 'Fiber' },
                        { label: 'Sugar', val: filteredMacros.sugar, unit: 'g', name: 'Sugar' },
                        { label: 'Sodium', val: filteredMacros.sodium, unit: 'mg', name: 'Sodium' },
                        { label: 'Chol.', val: filteredMacros.cholesterol, unit: 'mg', name: 'Cholesterol' },
                    ].map(m => (
                        <div key={m.label} className="text-center flex-1 cursor-pointer active:scale-95 transition-transform" onClick={() => setSelectedNutrient(m.name)}>
                          <div className="text-[8px] font-black uppercase text-[var(--text-secondary)] tracking-widest opacity-40 mb-0.5">{m.label}</div>
                          <div className="text-xs font-bold text-[var(--text-primary)] font-mono">{Math.round(m.val)}<span className="text-[8px] opacity-30 ml-0.5">{m.unit}</span></div>
                        </div>
                    ))}
                  </div>

                  {Object.keys(filteredMacros.vitamins || {}).length > 0 && (
                    <div className="w-full mt-6 pt-4 border-t border-[var(--border)]">
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-3 opacity-60">Daily Micronutrient Status</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {Object.entries(filteredMacros.vitamins).slice(0, 4).map(([name, data]: [string, any]) => (
                          <div key={name} className="flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all" onClick={() => setSelectedNutrient(name)}>
                            <span className="text-[10px] font-medium text-[var(--text-primary)] truncate max-w-[80px]">{name}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1 bg-[var(--bg-app)] rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(data.daily_value_pct, 100)}%` }} className={`h-full ${data.daily_value_pct >= 100 ? 'bg-green-500' : 'bg-[var(--primary)]'}`} />
                              </div>
                              <span className="text-[9px] font-bold tabular-nums w-6 text-right font-mono">{Math.round(data.daily_value_pct)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </motion.div>

              <motion.div variants={item} className="space-y-4 pt-4">
                <h3 className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-[0.2em] px-2">Meal Feed</h3>
                <AnimatePresence mode="popLayout">
                    {filteredLogs.length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 bg-[var(--bg-surface)] rounded-[24px] border border-dashed border-[var(--border)]">
                        <Utensils size={32} className="mx-auto text-[var(--text-secondary)] opacity-20 mb-3" />
                        <p className="text-sm text-[var(--text-secondary)] opacity-50 font-medium">No meals logged for this day</p>
                    </motion.div>
                    ) : (
                    filteredLogs.map((log: LogEntry) => (
                        <LogEntryCard key={log.id} log={log} />
                    ))
                    )}
                </AnimatePresence>
              </motion.div>
              
              <NutrientInfoModal nutrientName={selectedNutrient || ''} isOpen={!!selectedNutrient} onClose={() => setSelectedNutrient(null)} />
              
              <motion.button 
                onClick={() => router.push('/vision')}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="fixed bottom-24 right-6 w-16 h-16 bg-[var(--primary)] text-white rounded-2xl shadow-2xl shadow-[var(--primary)]/40 flex items-center justify-center z-50"
              >
                <Plus size={36} strokeWidth={3} />
              </motion.button>
            </motion.div>
          )}

          {/* INSIGHTS TAB */}
          {activeTab === 'insights' && (
            <motion.div key="insights" variants={container} initial="hidden" animate="show" exit={{ opacity: 0, y: -10 }} className="space-y-6">
              
              <motion.div variants={item} className="flex justify-between items-center mb-2">
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
              </motion.div>

              {insightsLoading ? (
                 <div className="py-20 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-[var(--primary)] border-t-transparent animate-spin" /></div>
              ) : (
                <>
                  <motion.div variants={item} className="grid grid-cols-2 gap-4">
                    <div className="bg-[var(--bg-surface)] p-6 rounded-[32px] border border-[var(--border)] shadow-sm">
                      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-widest mb-3">
                        <Flame size={12} className="text-[var(--primary)]" />
                        <span>Daily Avg</span>
                      </div>
                      <div className="text-3xl font-black text-[var(--text-primary)]">{stats?.total_calories || 0}</div>
                      <div className="text-[10px] font-bold text-[var(--text-secondary)] opacity-50 uppercase mt-1">kcal / day</div>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-6 rounded-[32px] border border-[var(--border)] shadow-sm">
                      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-widest mb-3">
                        <Calendar size={12} className="text-[var(--primary)]" />
                        <span>Samples</span>
                      </div>
                      <div className="text-3xl font-black text-[var(--text-primary)]">{stats?.log_count || 0}</div>
                      <div className="text-[10px] font-bold text-[var(--text-secondary)] opacity-50 uppercase mt-1">tracked items</div>
                    </div>
                  </motion.div>

                  <motion.div variants={item} className="bg-[var(--bg-surface)] rounded-[40px] p-8 shadow-sm border border-[var(--border)] relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8 relative z-10">
                      <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">Macro Balance</h3>
                      <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-widest">{timeRange} Day Mean</span>
                    </div>
                    
                    {stats && stats.log_count > 0 ? (
                      <div className="space-y-6 relative z-10">
                        {[
                          { label: 'Protein', current: stats.protein_avg, target: proteinTarget, icon: Zap },
                          { label: 'Carbs', current: stats.carbs_avg, target: carbsTarget, icon: Flame },
                          { label: 'Fats', current: stats.fats_avg, target: fatsTarget, icon: Droplets },
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
                              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((m.current / m.target) * 100, 100)}%` }} transition={{ duration: 1.5, ease: "easeOut" }} className="h-full bg-[var(--primary)] rounded-full" />
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

                  {stats && stats.log_count > 0 && (
                    <motion.div variants={item} className="bg-[var(--secondary)] rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl">
                      <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-[var(--primary)]/20 rounded-full blur-3xl" />
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--primary)] mb-6">Total Interval Intake</h3>
                      <div className="grid grid-cols-3 gap-4 relative z-10">
                        <div className="text-center">
                          <div className="text-xl font-black">{stats.protein_total}g</div>
                          <div className="text-[8px] font-bold uppercase text-[var(--text-secondary)] mt-1">Protein</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-black">{stats.carbs_total}g</div>
                          <div className="text-[8px] font-bold uppercase text-[var(--text-secondary)] mt-1">Carbs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-black">{stats.fats_total}g</div>
                          <div className="text-[8px] font-bold uppercase text-[var(--text-secondary)] mt-1">Fats</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
