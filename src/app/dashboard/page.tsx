'use client';

import React from 'react';
import { 
  Camera, 
  ShoppingCart, 
  Sparkles, 
  Flame, 
  Target, 
  Activity, 
  MessageSquare,
  Zap,
  Droplets,
  ChevronRight,
  LayoutGrid,
  UtensilsCrossed,
  Package,
  User,
  Settings,
  Bell,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import Link from 'next/link';
import { useConnectionMode } from '@/lib/hooks/useConnectionMode';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { useRouter } from 'next/navigation';

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
};

export default function DashboardPage() {
  useConnectionMode();
  const { 
    user, 
    advice, 
    dailyMacros, 
    loading, 
  } = useDashboardData();

  const router = useRouter();

  const meta = user?.metabolic_state_json || {};
  const calorieGoal = meta.bmr || 2100;
  const proteinTarget = meta.protein_target || 140;
  const carbsTarget = meta.carbs_target || 180;
  const fatsTarget = meta.fats_target || 65;

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
                <span className="text-5xl font-black text-[var(--text-primary)]">{user?.streak_count > 0 ? 88 + user.streak_count : 88}</span>
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
          {[
            { onClick: () => router.push('/vision'), icon: Camera, label: 'Scan', color: 'bg-blue-50/50 text-blue-500 border-blue-100' },
            { onClick: () => router.push('/planner'), icon: Target, label: 'Plan', color: 'bg-purple-50/50 text-purple-500 border-purple-100' },
            { onClick: () => router.push('/shopping'), icon: ShoppingCart, label: 'Shop', color: 'bg-emerald-50/50 text-emerald-500 border-emerald-100' },
            { onClick: () => router.push('/coach'), icon: MessageSquare, label: 'Coach', color: 'bg-amber-50/50 text-amber-500 border-amber-100' },
          ].map((action) => (
            <motion.div key={action.label} variants={item}>
              <button onClick={action.onClick} className="flex flex-col items-center gap-2 group w-full">
                <motion.div 
                  whileHover={{ scale: 1.1, y: -5 }}
                  whileTap={{ scale: 0.9 }}
                  className={`w-16 h-16 rounded-[24px] ${action.color} flex items-center justify-center shadow-sm border group-hover:shadow-xl transition-all`}
                >
                  <action.icon size={24} strokeWidth={2.5} />
                </motion.div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 transition-opacity">{action.label}</span>
              </button>
            </motion.div>
          ))}
        </div>

        {/* Macros Row */}
        <motion.div variants={item} className="grid grid-cols-3 gap-3">
            {[
              { label: 'Protein', value: dailyMacros.protein, target: proteinTarget, icon: Zap },
              { label: 'Carbs', value: dailyMacros.carbs, target: carbsTarget, icon: Flame },
              { label: 'Fats', value: dailyMacros.fats, target: fatsTarget, icon: Droplets },
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
