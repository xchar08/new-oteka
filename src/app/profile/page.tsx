'use client';

import React from 'react';
import { 
  User, 
  Settings, 
  Target, 
  Shield, 
  ChevronRight,
  LogOut,
  Sparkles,
  Zap,
  Flame,
  Droplets,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { BottomNav } from '@/components/layout/BottomNav';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', damping: 15, stiffness: 100 }
  }
};

export default function ProfilePage() {
  const { user, dailyMacros, loading } = useDashboardData();
  const supabase = createClient();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
     return (
       <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
         <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
       </div>
     );
  }

  // Calculate targets from user profile or defaults
  const meta = user?.metabolic_state_json || {};
  const targets = {
    protein: meta.protein_target || 140,
    carbs: meta.carbs_target || 180,
    fats: meta.fats_target || 65,
    calories: meta.bmr || 2100
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] pb-32 font-sans overflow-x-hidden transition-colors duration-500">
      {/* Top App Bar */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-6 pt-8 pb-4 flex justify-between items-center bg-[var(--bg-app)]/80 backdrop-blur-md sticky top-0 z-40"
      >
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Profile</h1>
        </div>
        <motion.button 
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => router.push('/settings')}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] shadow-sm border border-[var(--primary)]/10 text-[var(--text-secondary)]"
        >
          <Settings size={20} />
        </motion.button>
      </motion.header>

      {/* Profile Header */}
      <section className="px-6 py-10 flex flex-col items-center">
        <motion.div 
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12 }}
          className="relative"
        >
          <div className="w-28 h-28 rounded-[32px] overflow-hidden border-4 border-[var(--bg-surface)] shadow-2xl relative z-10 bg-[var(--bg-surface)] flex items-center justify-center">
            {user?.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.display_name || "Profile"} 
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={48} className="text-[var(--text-secondary)] opacity-20" />
            )}
          </div>
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-2 bg-gradient-to-tr from-[var(--primary)] to-yellow-300 rounded-[40px] opacity-20 blur-sm"
          />
          <motion.div 
            whileHover={{ scale: 1.2 }}
            className="absolute -bottom-2 -right-2 w-10 h-10 bg-[var(--primary)] text-white rounded-xl flex items-center justify-center shadow-lg z-20"
          >
            <Sparkles size={18} />
          </motion.div>
        </motion.div>
        
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-black text-[var(--text-primary)] mt-6 text-center"
        >
          {user?.display_name || "Explorer"}
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--primary)] mt-1"
        >
          Metabolic Score: {user?.streak_count > 0 ? 88 + user.streak_count : 88} • {user?.streak_count > 5 ? 'ELITE' : 'ACTIVE'}
        </motion.p>
      </section>

      {/* Main Content */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-6 space-y-6"
      >
        {/* Metabolic Goals Card */}
        <motion.div 
          variants={cardVariants}
          whileHover={{ y: -5 }}
          className="bg-[var(--primary)] rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-[var(--primary)]/30"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity size={120} strokeWidth={1} />
          </div>
          
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Daily Summary</h3>
              <p className="text-3xl font-black">{((dailyMacros.calories / targets.calories) * 100).toFixed(1)}%</p>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase">
              {dailyMacros.calories > targets.calories ? 'Over Goal' : 'On Track'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-6 gap-x-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg"><Zap size={16} /></div>
              <div>
                <p className="text-[10px] opacity-70 uppercase font-bold">Protein</p>
                <p className="font-bold">{dailyMacros.protein.toFixed(0)}g<span className="text-[10px] opacity-50 ml-1">/{targets.protein}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg"><Flame size={16} /></div>
              <div>
                <p className="text-[10px] opacity-70 uppercase font-bold">Carbs</p>
                <p className="font-bold">{dailyMacros.carbs.toFixed(0)}g<span className="text-[10px] opacity-50 ml-1">/{targets.carbs}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg"><Droplets size={16} /></div>
              <div>
                <p className="text-[10px] opacity-70 uppercase font-bold">Fats</p>
                <p className="font-bold">{dailyMacros.fats.toFixed(0)}g<span className="text-[10px] opacity-50 ml-1">/{targets.fats}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg"><Target size={16} /></div>
              <div>
                <p className="text-[10px] opacity-70 uppercase font-bold">Calories</p>
                <p className="font-bold">{dailyMacros.calories.toFixed(0)}<span className="text-[10px] opacity-50 ml-1">/{targets.calories}</span></p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Settings List */}
        <motion.div 
          variants={cardVariants}
          className="bg-[var(--bg-surface)] rounded-[24px] overflow-hidden shadow-xl shadow-[var(--primary)]/5 border border-[var(--primary)]/5"
        >
          <div className="px-6 py-2">
            {[
              { icon: Settings, label: 'Configuration', onClick: () => router.push('/settings') },
              { icon: Target, label: 'Pricing & Plans', onClick: () => router.push('/pricing') },
              { icon: Shield, label: 'Privacy Policy', onClick: () => router.push('/privacy') },
              { icon: LogOut, label: 'Sign Out', danger: true, onClick: handleSignOut },
            ].map((item, i, arr) => (
              <motion.button 
                key={item.label}
                onClick={item.onClick}
                whileHover={{ x: 5 }}
                className={`w-full flex items-center justify-between py-5 ${i !== arr.length - 1 ? 'border-b border-[var(--border)] opacity-20' : ''} group`}
              >
                <div className={`flex items-center gap-4 ${item.danger ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
                  <item.icon size={20} strokeWidth={item.danger ? 2.5 : 2} />
                  <span className="font-bold text-sm">{item.label}</span>
                </div>
                <ChevronRight size={18} className="text-gray-200 group-hover:text-[var(--primary)] transition-colors" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      </motion.div>

      <div className="px-6 mt-12 text-center">
        <p className="text-[10px] font-bold uppercase text-[var(--text-secondary)] opacity-30 tracking-[0.4em]">Solar Core v3.1.1</p>
      </div>

      <BottomNav />
    </div>
  );
}
