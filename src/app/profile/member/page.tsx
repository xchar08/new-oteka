'use client';

import React, { useEffect, useState } from 'react';
import { 
  User, 
  ChevronLeft,
  Flame,
  Activity,
  Sparkles
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', damping: 15, stiffness: 100 }
  }
};

function ProfileContent() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  useEffect(() => {
    async function loadProfile() {
      if (!id) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url, streak_count, created_at')
        .eq('id', id)
        .single();
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const isoDate = thirtyDaysAgo.toISOString().split('T')[0];
      
      const { data: logsData } = await supabase
        .from('logs')
        .select('local_date')
        .eq('user_id', id)
        .gte('local_date', isoDate);
      
      if (data) setProfile({ ...data, logs: logsData || [] });
      setLoading(false);
    }
    loadProfile();
  }, [id]);

  if (loading) {
     return (
       <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
         <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
       </div>
     );
  }

  if (!profile) {
      return (
          <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col items-center justify-center space-y-4">
              <User size={48} className="opacity-20" />
              <h2 className="text-xl font-black">Explorer not found.</h2>
              <button onClick={() => router.back()} className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl font-bold">Go Back</button>
          </div>
      );
  }

  const streak = profile.streak_count || 0;
  const isElite = streak > 5;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] pb-32 font-sans overflow-x-hidden transition-colors duration-500">
      {/* Top App Bar */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-6 pt-12 pb-8 bg-gradient-to-b from-[var(--primary)]/10 to-transparent rounded-b-[40px]"
      >
        <div className="flex items-center gap-4">
          <button 
              onClick={() => router.back()}
              className="w-10 h-10 bg-[var(--bg-surface)] rounded-xl flex items-center justify-center shadow-sm border border-[var(--primary)]/10 text-[var(--text-secondary)]"
          >
              <ChevronLeft size={20} />
          </button>
          <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)] capitalize">{profile.display_name}&apos;s Profile</h1>
        </div>
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
            {profile.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.display_name || "Profile"} 
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
          {isElite && (
              <motion.div 
                whileHover={{ scale: 1.2 }}
                className="absolute -bottom-2 -right-2 w-10 h-10 bg-[var(--primary)] text-white rounded-xl flex items-center justify-center shadow-lg z-20"
              >
                <Sparkles size={18} />
              </motion.div>
          )}
        </motion.div>
        
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-black text-[var(--text-primary)] mt-6 text-center capitalize"
        >
          {profile.display_name || "Explorer"}
        </motion.h2>
        
        <div className="flex flex-col items-center gap-3 mt-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-1.5 text-[var(--primary)] font-bold bg-[var(--bg-surface)] px-3 py-1.5 rounded-xl shadow-sm border border-[var(--primary)]/10"
          >
            <Flame size={14} fill="currentColor" />
            <span className="text-[9px] uppercase tracking-widest">{streak} Day Streak</span>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--primary)] opacity-60"
          >
            Metabolic Score: {streak > 0 ? 88 + streak : 88} • {isElite ? 'ELITE' : 'ACTIVE'}
          </motion.p>
        </div>
      </section>

      {/* Main Content */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-6 space-y-6"
      >
        <motion.div 
          variants={cardVariants}
          className="bg-[var(--primary)] rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl shadow-[var(--primary)]/30"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity size={120} strokeWidth={1} />
          </div>
          
          <div className="flex flex-col items-center text-center">
            <div className="p-4 bg-white/20 rounded-2xl mb-4 shadow-inner"><Flame size={32} fill="currentColor" /></div>
            <p className="text-[10px] opacity-70 uppercase font-black tracking-[0.25em] mb-1">Active Streak</p>
            <p className="font-black text-5xl">{streak} <span className="text-lg opacity-80 font-bold uppercase tracking-widest ml-1">Days</span></p>
          </div>
        </motion.div>

        {/* Activity Heatmap */}
        <motion.div variants={cardVariants} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[40px] p-8 space-y-6 shadow-sm">
           <div className="flex items-center gap-2">
             <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                <Activity size={14} />
             </div>
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">30-Day Pulse</h3>
           </div>
           <div className="grid grid-cols-7 gap-2">
             {Array.from({ length: 28 }).map((_, i) => {
               const d = new Date();
               d.setDate(d.getDate() - (27 - i));
               const dateStr = d.toISOString().split('T')[0];
               const hasLog = profile.logs?.some((l: any) => l.local_date === dateStr);
               return (
                 <div 
                   key={i} 
                   className={`aspect-square rounded-xl ${hasLog ? 'bg-[var(--primary)] shadow-sm' : 'bg-[var(--bg-app)] border border-[var(--border)] opacity-30'} transition-all flex items-center justify-center`}
                   title={dateStr}
                 >
                   {hasLog && <div className="w-1.5 h-1.5 rounded-full bg-white/50" />}
                 </div>
               );
             })}
           </div>
        </motion.div>

        <motion.div variants={cardVariants} className="text-center text-[var(--text-secondary)] opacity-30 text-[9px] font-black uppercase tracking-[0.4em] mt-12">
            Protocol Initiated {new Date(profile.created_at).toLocaleDateString()}
        </motion.div>

      </motion.div>
    </div>
  );
}

export default function PublicProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div>}>
      <ProfileContent />
    </Suspense>
  );
}
