'use client';

import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  ShoppingCart as ShoppingCartIcon, 
  Sparkles, 
  Flame, 
  Target, 
  Activity as ActivityIcon, 
  Zap,
  Droplets,
  ChevronRight,
  LayoutGrid,
  UtensilsCrossed,
  Package,
  User,
  Settings,
  Bell,
  CheckCircle2,
  Star,
  AlertTriangle,
  Crown,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import Link from 'next/link';
import { useConnectionMode } from '@/lib/hooks/useConnectionMode';
import { useUser } from '@/lib/hooks/useUser';
import { useMetabolicLogs } from '@/lib/hooks/useMetabolicLogs';
import { useRouter } from 'next/navigation';
import { PricingGuard } from '@/components/ui/PricingGuard';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 100 }
  }
} as const;

export default function DashboardPage() {
  useConnectionMode();
  const { user, loading: userLoading } = useUser();
  const { dailyMacros, advice, dailyLogs = [], loading: logsLoading } = useMetabolicLogs();
  const loading = userLoading || logsLoading;

  const router = useRouter();

  const meta = user?.metabolic_state_json || {};
  const calorieGoal = user?.calorie_target || 2000;
  const proteinTarget = meta.protein_target || 140;
  const carbsTarget = meta.carbs_target || 180;
  const fatsTarget = meta.fats_target || 65;
  
  // SUPPORT PRO PLAN
  const isPro = user?.plan === 'pro';
  const isMissingCalibration = !user?.hand_width_mm;

  if (loading)
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
         <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] pb-32 font-sans overflow-x-hidden transition-colors">
      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-6 pt-12 pb-8 bg-gradient-to-b from-[var(--primary)]/10 to-transparent rounded-b-[40px]"
      >
        <div className="flex justify-between items-start">
          <div>
            <motion.h1 
              initial={{ x: -20 }}
              animate={{ x: 0 }}
              className="text-3xl font-black tracking-tight"
            >
              Good Morning, <br />
              <span className="text-[var(--primary)]">{user?.display_name?.split(' ')[0] || 'Explorer'}</span>
            </motion.h1>
            <div className="flex items-center gap-3 mt-4">
               <motion.div 
                 whileHover={{ scale: 1.05 }}
                 className="flex items-center gap-1.5 text-[var(--primary)] font-bold bg-[var(--bg-surface)] px-3 py-1.5 rounded-xl shadow-sm border border-[var(--primary)]/10"
               >
                 <Flame size={14} fill="currentColor" />
                 <span className="text-[9px] uppercase tracking-widest">{user?.streak_count || 0} Day Streak</span>
               </motion.div>

               {isPro && (
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="flex items-center gap-1.5 text-[var(--primary)] font-black bg-[var(--primary)]/10 px-3 py-1.5 rounded-xl shadow-sm border border-[var(--primary)]/20"
                  >
                    <Crown size={12} fill="currentColor" />
                    <span className="text-[9px] uppercase tracking-widest">Solar Active</span>
                  </motion.div>
               )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
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
                {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                <User size={22} className="text-[var(--primary)]" />
                )}
            </motion.div>
          </div>
        </div>
      </motion.header>

      <motion.main 
        variants={container}
        initial="hidden"
        animate="show"
        className="px-6 -mt-4 space-y-6"
      >
        {/* Metabolic Assessment Banner */}
        {(() => {
          const latestUnratedLog = dailyLogs.find(log => {
            const tags = log.metabolic_tags_json as any;
            return !tags?.user_score && !tags?.feedback;
          });

          if (!latestUnratedLog) return null;

          const mealTime = new Date(latestUnratedLog.captured_at).getTime();
          const diffMins = Math.floor((Date.now() - mealTime) / 60000);
          const mealName = latestUnratedLog.metabolic_tags_json?.food_name || latestUnratedLog.metabolic_tags_json?.item || 'Latest Meal';

          if (diffMins >= 0 && diffMins < 30) {
            const minsRemaining = 30 - diffMins;
            return (
              <motion.div 
                variants={item}
                className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[28px] p-4 flex items-center justify-between shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 h-1 bg-[var(--primary)]/30 w-full">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(diffMins / 30) * 100}%` }}
                    className="h-full bg-[var(--primary)]"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)] animate-pulse">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">Digesting {mealName}</h4>
                    <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-0.5">Energy calibration window opens in {minsRemaining}m</p>
                  </div>
                </div>
              </motion.div>
            );
          }

          if (diffMins >= 30 && diffMins <= 180) {
            return (
              <motion.div 
                variants={item}
                whileHover={{ scale: 1.02 }}
                onClick={() => router.push('/rating')}
                className="bg-gradient-to-r from-[var(--primary)]/20 to-[var(--primary)]/5 border border-[var(--primary)]/30 rounded-[32px] p-5 shadow-lg shadow-[var(--primary)]/5 cursor-pointer relative overflow-hidden group"
              >
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

        {/* Advisor Card */}
        <motion.div 
          variants={item}
          whileHover={{ y: -5 }}
          className="bg-[var(--bg-surface)] rounded-[32px] p-6 shadow-sm border border-[var(--border)] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Sparkles size={80} strokeWidth={1} />
          </div>
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
              <Sparkles size={14} />
            </div>
            <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-[0.2em]">Metabolic Advisor</span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-primary)] opacity-80 relative z-10 font-medium italic">
            "{advice || "Analyzing your metabolic alignment..."}"
          </p>
        </motion.div>

        {/* Hero: Solar Ring Score */}
        <motion.div 
          variants={item}
          className="bg-[var(--bg-surface)] rounded-[40px] p-8 shadow-sm border border-[var(--border)] relative overflow-hidden flex flex-col items-center"
        >
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-3xl" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-50 mb-8">Metabolic Score</h3>
          
          <div className="relative w-56 h-56 flex items-center justify-center">
             <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="112"
                  cy="112"
                  r="100"
                  stroke="currentColor"
                  strokeWidth="16"
                  fill="transparent"
                  className="text-[var(--bg-app)]"
                />
                <motion.circle
                  initial={{ strokeDasharray: "0 628" }}
                  animate={{ strokeDasharray: `${Math.min((dailyMacros.calories / calorieGoal) * 628, 628)} 628` }}
                  transition={{ duration: 2.5, ease: "easeOut", delay: 0.5 }}
                  cx="112"
                  cy="112"
                  r="100"
                  stroke="currentColor"
                  strokeWidth="16"
                  strokeLinecap="round"
                  fill="transparent"
                  className="text-[var(--primary)]"
                />
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

        {/* Quick Action Grid */}
        <div className="grid grid-cols-4 gap-3">
          <motion.div variants={item}>
            <button onClick={() => router.push('/vision')} className="flex flex-col items-center gap-2 group w-full">
              <motion.div 
                whileHover={{ scale: 1.1, y: -5 }}
                whileTap={{ scale: 0.9 }}
                className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-sm group-hover:shadow-xl transition-all border bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20`}
              >
                <Camera size={24} strokeWidth={2.5} />
              </motion.div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 transition-opacity">Scan</span>
            </button>
          </motion.div>

          <motion.div variants={item}>
            <PricingGuard plan={user?.plan} featureName="Planner">
              <button onClick={() => router.push('/pantry')} className="flex flex-col items-center gap-2 group w-full">
                <motion.div 
                  whileHover={{ scale: 1.1, y: -5 }}
                  whileTap={{ scale: 0.9 }}
                  className={`w-16 h-16 rounded-[24px] border flex items-center justify-center shadow-sm group-hover:shadow-xl transition-all bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20`}
                >
                  <Target size={24} strokeWidth={2.5} />
                </motion.div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 transition-opacity">Plan</span>
              </button>
            </PricingGuard>
          </motion.div>

          <motion.div variants={item}>
            <PricingGuard plan={user?.plan} featureName="Shopping Logistics">
              <button onClick={() => router.push('/shopping')} className="flex flex-col items-center gap-2 group w-full">
                <motion.div 
                  whileHover={{ scale: 1.1, y: -5 }}
                  whileTap={{ scale: 0.9 }}
                  className={`w-16 h-16 rounded-[24px] border flex items-center justify-center shadow-sm group-hover:shadow-xl transition-all bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20`}
                >
                  <ShoppingCartIcon size={24} strokeWidth={2.5} />
                </motion.div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 transition-opacity">Shop</span>
              </button>
            </PricingGuard>
          </motion.div>

          <motion.div variants={item}>
            <button onClick={() => router.push('/log')} className="flex flex-col items-center gap-2 group w-full">
              <motion.div 
                whileHover={{ scale: 1.1, y: -5 }}
                whileTap={{ scale: 0.9 }}
                className={`w-16 h-16 rounded-[24px] border flex items-center justify-center shadow-sm group-hover:shadow-xl transition-all bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20`}
              >
                <ActivityIcon size={24} strokeWidth={2.5} />
              </motion.div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 transition-opacity">Logs</span>
            </button>
          </motion.div>
        </div>

        {/* Macros Row */}
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
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((macro.value / macro.target) * 100, 100)}%` }}
                    className="h-full bg-[var(--primary)] rounded-full"
                  />
                </div>
              </div>
            ))}
        </motion.div>
      </motion.main>

      <BottomNav />
    </div>
  );
}
