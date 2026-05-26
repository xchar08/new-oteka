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
        .from('users')
        .select('id, display_name, avatar_url, streak_count, created_at')
        .eq('id', id)
        .single();
      
      if (data) setProfile(data);
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
        className="px-6 pt-8 pb-4 flex justify-between items-center bg-[var(--bg-app)]/80 backdrop-blur-md sticky top-0 z-40"
      >
        <div className="flex items-center gap-4">
          <button 
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
          >
              <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] capitalize">{profile.display_name}&apos;s Profile</h1>
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
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--primary)] mt-1"
        >
          Metabolic Score: {streak > 0 ? 88 + streak : 88} • {isElite ? 'ELITE' : 'ACTIVE'}
        </motion.p>
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
          className="bg-[var(--primary)] rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-[var(--primary)]/30"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity size={120} strokeWidth={1} />
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl"><Flame size={24} /></div>
            <div>
              <p className="text-[10px] opacity-70 uppercase font-bold tracking-widest">Active Streak</p>
              <p className="font-black text-3xl">{streak} <span className="text-lg opacity-80 font-bold">days</span></p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={cardVariants} className="text-center text-[var(--text-secondary)] opacity-40 text-[10px] font-black uppercase tracking-widest mt-12">
            Joined {new Date(profile.created_at).toLocaleDateString()}
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
