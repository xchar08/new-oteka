'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Bell, 
  ChevronRight,
  Barcode,
  Flame,
  Zap,
  Droplets,
  Menu,
  Clock,
  Camera,
  Utensils,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { useRouter } from 'next/navigation';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
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

export default function LogPage() {
  const { user, dailyLogs, loading } = useDashboardData();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const router = useRouter();
  
  const calorieGoal = user?.metabolic_state_json?.bmr || 2100;

  // Generate current week dates
  const today = new Date();
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    // Start from Monday of current week
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
    d.setDate(diff + i);
    return {
      fullDate: new Date(d),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.getDate().toString(),
    };
  });

  // Filter logs by selected date
  const filteredLogs = dailyLogs.filter((log: any) => {
      const logDate = new Date(log.captured_at);
      return logDate.getDate() === selectedDate.getDate() && 
             logDate.getMonth() === selectedDate.getMonth() &&
             logDate.getFullYear() === selectedDate.getFullYear();
  });

  // Aggregate Macros for filtered logs
  const filteredMacros = filteredLogs.reduce((acc, log) => {
    const m = log.metabolic_tags_json || {};
    return {
      calories: acc.calories + (Number(m.calories) || 0),
      protein: acc.protein + (Number(m.protein) || 0),
      carbs: acc.carbs + (Number(m.carbs) || 0),
      fats: acc.fats + (Number(m.fats || m.fat) || 0),
    };
  }, { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const caloriesLeft = Math.max(0, calorieGoal - filteredMacros.calories);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] pb-32 font-sans overflow-x-hidden transition-colors duration-500">
      {/* Top App Bar */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-6 pt-8 pb-4 flex justify-between items-center bg-[var(--bg-app)]/80 backdrop-blur-md sticky top-0 z-40"
      >
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Daily Log</h1>
        </div>
        <div className="flex items-center gap-3">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] shadow-sm border border-[var(--border)]"
          >
            <Bell size={20} className="text-[var(--primary)]" />
          </motion.button>
          <motion.div 
            onClick={() => router.push('/profile')}
            whileHover={{ scale: 1.1 }}
            className="w-10 h-10 rounded-xl overflow-hidden border-2 border-[var(--primary)]/20 shadow-sm bg-[var(--bg-surface)] flex items-center justify-center cursor-pointer"
          >
            {user?.avatar_url ? (
               <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
               <User size={20} className="text-[var(--text-secondary)]" />
            )}
          </motion.div>
        </div>
      </motion.header>

      {/* Date Selector */}
      <section className="px-6 py-4 overflow-x-auto scrollbar-hide">
        <motion.div 
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex justify-between min-w-full gap-3"
        >
          {weekDates.map((d, i) => {
            const isActive = d.fullDate.getDate() === selectedDate.getDate() && 
                             d.fullDate.getMonth() === selectedDate.getMonth();
            return (
                <motion.button 
                key={i} 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDate(d.fullDate)}
                className={`flex flex-col items-center justify-center min-w-[54px] py-4 rounded-2xl transition-all duration-300 ${
                    isActive 
                    ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/30 scale-110' 
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] shadow-sm'
                }`}
                >
                <span className="text-[10px] font-bold uppercase tracking-widest mb-1">{d.day}</span>
                <span className="text-base font-black">{d.date}</span>
                </motion.button>
            );
          })}
        </motion.div>
      </section>

      {/* Hero: Solar Ring Progress */}
      <section className="px-6 py-8">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-8 shadow-sm flex flex-col items-center relative overflow-hidden"
        >
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-3xl" />
          
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                className="text-[var(--bg-app)]"
              />
              <motion.circle
                initial={{ strokeDasharray: "0 553" }}
                animate={{ strokeDasharray: `${Math.min((filteredMacros.calories / calorieGoal) * 553, 553)} 553` }}
                transition={{ duration: 2, ease: "easeOut" }}
                cx="96"
                cy="96"
                r="88"
                stroke="currentColor"
                strokeWidth="12"
                strokeDashcap="round"
                fill="transparent"
                className="text-[var(--primary)]"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-[var(--text-primary)]">{caloriesLeft.toLocaleString()}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">kcal left</span>
            </div>
          </div>

          <div className="grid grid-cols-3 w-full mt-10 gap-4">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">Protein</p>
              <p className="font-bold text-[var(--text-primary)]">{filteredMacros.protein.toFixed(0)}g</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">Carbs</p>
              <p className="font-bold text-[var(--text-primary)]">{filteredMacros.carbs.toFixed(0)}g</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">Fats</p>
              <p className="font-bold text-[var(--text-primary)]">{filteredMacros.fats.toFixed(0)}g</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Actions Bar */}
      <section className="px-6 mb-8 flex gap-3">
        <motion.button 
          onClick={() => router.push('/vision')}
          whileHover={{ scale: 1.02, backgroundColor: 'var(--primary)', color: '#fff' }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 bg-[var(--bg-surface)] text-[var(--primary)] border-2 border-[var(--primary)] rounded-2xl py-4 flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-xs transition-colors shadow-sm"
        >
          <Barcode size={20} />
          Scan Code
        </motion.button>
        <motion.button 
          onClick={() => router.push('/vision')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 bg-[var(--secondary)] text-white rounded-2xl py-4 flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-xs shadow-lg"
        >
          <Camera size={20} />
          AI Vision
        </motion.button>
      </section>

      {/* Meal Feed */}
      <motion.section 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-6 space-y-6"
      >
        <div className="flex justify-between items-center px-2">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Recent Logs</h3>
          <button 
            onClick={() => router.push('/history')}
            className="text-[10px] font-bold uppercase text-[var(--primary)] tracking-widest hover:opacity-70 transition-opacity"
          >
            See All
          </button>
        </div>

        <AnimatePresence mode="popLayout">
            {filteredLogs.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 bg-[var(--bg-surface)] rounded-[24px] border border-dashed border-[var(--border)]">
                <Utensils size={32} className="mx-auto text-[var(--text-secondary)] opacity-20 mb-3" />
                <p className="text-sm text-[var(--text-secondary)] opacity-50 font-medium">No meals logged for this day</p>
            </motion.div>
            ) : (
            filteredLogs.map((log: any) => {
                const meta = log.metabolic_tags_json || {};
                const macros = meta.macros || meta || {};
                const name = meta.food_name || meta.item || 'Unknown Food';
                const time = new Date(log.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                <motion.div key={log.id} layout variants={itemVariants} className="bg-[var(--bg-surface)] rounded-[24px] p-4 shadow-sm border border-[var(--border)]">
                    <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-inner bg-[var(--bg-app)] flex items-center justify-center border border-[var(--border)]">
                        {log.image_url ? (
                        <img src={log.image_url} alt={name} className="w-full h-full object-cover" />
                        ) : (
                        <Utensils size={32} className="text-[var(--text-secondary)] opacity-10" />
                        )}
                    </div>
                    <div className="flex-1 py-1 flex flex-col justify-between min-w-0">
                        <div>
                        <div className="flex justify-between items-start">
                            <h4 className="font-bold text-[var(--text-primary)] leading-tight capitalize truncate w-[80%]">{name}</h4>
                            <Clock size={14} className="text-[var(--text-secondary)] opacity-30" />
                        </div>
                        <p className="text-[10px] font-bold uppercase text-[var(--primary)] mt-1 tracking-wider">{time}</p>
                        </div>
                        <div className="flex gap-4">
                        <div className="text-[10px] font-bold text-[var(--text-primary)] flex flex-col">
                            <span className="text-[var(--text-secondary)] opacity-40">P</span>
                            <span>{Number(macros.protein || 0).toFixed(0)}g</span>
                        </div>
                        <div className="text-[10px] font-bold text-[var(--text-primary)] flex flex-col">
                            <span className="text-[var(--text-secondary)] opacity-40">C</span>
                            <span>{Number(macros.carbs || 0).toFixed(0)}g</span>
                        </div>
                        <div className="text-[10px] font-bold text-[var(--text-primary)] flex flex-col">
                            <span className="text-[var(--text-secondary)] opacity-40">F</span>
                            <span>{Number(macros.fats || macros.fat || 0).toFixed(0)}g</span>
                        </div>
                        <div className="ml-auto text-right">
                            <span className="text-xs font-black text-[var(--text-primary)]">{Number(macros.calories || 0).toFixed(0)}</span>
                            <span className="text-[8px] font-bold text-[var(--text-secondary)] opacity-40 block uppercase">kcal</span>
                        </div>
                        </div>
                    </div>
                    </div>
                </motion.div>
                );
            })
            )}
        </AnimatePresence>
      </motion.section>

      {/* Floating Action Button */}
      <motion.button 
        onClick={() => router.push('/vision')}
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.5 }}
        className="fixed bottom-24 right-6 w-16 h-16 bg-[var(--primary)] text-white rounded-2xl shadow-2xl shadow-[var(--primary)]/40 flex items-center justify-center z-50"
      >
        <Plus size={36} strokeWidth={3} />
      </motion.button>

      <BottomNav />
    </div>
  );
}
