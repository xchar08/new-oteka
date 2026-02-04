'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Camera, BookOpen, ShoppingCart, Plane, MessageSquare, History, BarChart2, Globe } from 'lucide-react';
import Link from 'next/link';
import { NutrientRadar } from '@/components/viz/NutrientRadar';
import { useConnectionMode } from '@/lib/hooks/useConnectionMode';
import { useAppStore } from '@/lib/state/appStore';
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  useConnectionMode(); // Init connection listener

  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [advice, setAdvice] = useState<string>('Analyzing metabolic state...');
  const [activeConditions, setActiveConditions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // FIX: Select state atomically
  const isOnline = useAppStore((s) => s.isOnline);

  useEffect(() => {
    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      
      if (!authUser) {
        router.push('/login');
        return;
      }

      // 1. Fetch Profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      setUser(profile);

      // 2. Fetch Active Conditions
      const { data: conditionsData } = await supabase
        .from('user_conditions')
        .select('conditions(name)')
        .eq('user_id', authUser.id);

      setActiveConditions(
        conditionsData?.map((c: any) => c.conditions?.name).filter(Boolean) ||
          []
      );

      // 3. Fetch Advice
      try {
        if (navigator.onLine) {
           const { data, error } = await supabase.functions.invoke('advisor-context', {
             body: { context: 'dashboard' }
           });

           if (!error && data) {
             setAdvice(data.advice || 'Metabolic state nominal.');
           } else {
             console.error('Advisor Function Error:', error);
             setAdvice('Advisor unavailable (Function Error)');
           }
        } else {
          setAdvice('Offline Mode: Using cached protocols.');
        }
      } catch (e) {
        console.error('Advisor Exception:', e);
        setAdvice('Advisor offline.');
      }

      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading)
    return <div className="p-6 text-gray-500">Syncing Metabolic State...</div>;

  return (
    <div className="min-h-screen bg-[var(--palenight-bg)] pb-24 text-zinc-100">
      {/* Header */}
      <header className="bg-[var(--palenight-surface)] p-6 pb-8 rounded-b-3xl shadow-sm space-y-4 border-b border-white/5">
         {/* ... (keep existing header content) ... */}
         <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-white">Good Morning</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-zinc-400 text-sm">
                Streak: {user?.streak_count || 0} Days
              </p>
              {!isOnline && (
                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs font-bold rounded-full">
                  OFFLINE
                </span>
              )}
            </div>
          </div>
          <div className="bg-[var(--palenight-accent)]/20 text-[var(--palenight-accent)] border border-[var(--palenight-accent)]/50 px-3 py-1 rounded-full text-xs font-bold capitalize">
            {user?.metabolic_state_json?.current_goal || 'Maintenance'}
          </div>
        </div>

        {/* Agentic Advice Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--palenight-bg)] border border-[var(--palenight-secondary)]/30 p-4 rounded-xl relative overflow-hidden shadow-md"
        >
          <div className="text-xs font-bold text-[var(--palenight-secondary)] mb-1 uppercase tracking-wide">
            Metabolic Advisor
          </div>
          <p className="text-zinc-300 text-sm font-medium leading-relaxed relative z-10">
            {advice}
          </p>
          <div className="absolute right-0 bottom-0 opacity-10">
            <BookOpen size={64} className="text-[var(--palenight-secondary)]" />
          </div>
        </motion.div>

        {/* Active Conditions */}
        {activeConditions.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-2">
            {activeConditions.map((c) => (
              <span
                key={c}
                className="text-xs px-2 py-1 bg-red-950/30 text-red-300 border border-red-900/50 rounded-md font-medium"
              >
                🛡️ {c} Check Active
              </span>
            ))}
          </div>
        )}
      </header>

      <motion.main 
        variants={container}
        initial="hidden"
        animate="show"
        className="p-6 space-y-6"
      >
        {/* Viz */}
        <motion.div variants={item} className="bg-[var(--palenight-surface)] p-4 rounded-xl shadow-lg border border-white/5">
          <h3 className="text-sm font-semibold text-zinc-400 mb-4">
            Nutrient Targeting
          </h3>
          {/* ... radar content ... */}
          {NutrientRadar ? (
            <NutrientRadar
              macros={[
                {
                  label: 'Protein',
                  current: 120,
                  target: 180,
                  color: 'bg-[var(--palenight-secondary)]',
                },
                {
                  label: 'Carbs',
                  current: 150,
                  target: 250,
                  color: 'bg-[var(--palenight-success)]',
                },
                {
                  label: 'Fats',
                  current: 45,
                  target: 70,
                  color: 'bg-[var(--palenight-warning)]',
                },
              ]}
            />
          ) : (
            <div className="h-40 bg-[var(--palenight-bg)] rounded flex items-center justify-center text-zinc-600 text-xs">
              Radar Placeholder
            </div>
          )}
        </motion.div>

        {/* Quick Actions Grid */}
        <motion.h3 variants={item} className="font-semibold text-zinc-400">Actions</motion.h3>
        <motion.div variants={item} className="grid grid-cols-2 gap-4">
          <Link
            href="/log"
            className="bg-[var(--palenight-surface)] p-4 rounded-xl shadow-lg border border-white/5 flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-[var(--palenight-secondary)]/20 rounded-full flex items-center justify-center text-[var(--palenight-secondary)]">
              <Camera size={20} />
            </div>
            <span className="font-medium text-sm text-zinc-200">Vision Log</span>
          </Link>

          <Link
            href="/pantry"
            className="bg-[var(--palenight-surface)] p-4 rounded-xl shadow-lg border border-white/5 flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-[var(--palenight-success)]/20 rounded-full flex items-center justify-center text-[var(--palenight-success)]">
              <BookOpen size={20} />
            </div>
            <span className="font-medium text-sm text-zinc-200">Pantry</span>
          </Link>

          <Link
            href="/shopping"
            className="bg-[var(--palenight-surface)] p-4 rounded-xl shadow-lg border border-white/5 flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-[var(--palenight-accent)]/20 rounded-full flex items-center justify-center text-[var(--palenight-accent)]">
              <ShoppingCart size={20} />
            </div>
            <span className="font-medium text-sm text-zinc-200">Shopping</span>
          </Link>

          <Link
            href="/travel/menu"
            className="bg-[var(--palenight-surface)] p-4 rounded-xl shadow-lg border border-white/5 flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-[var(--palenight-warning)]/20 rounded-full flex items-center justify-center text-[var(--palenight-warning)]">
              <Plane size={20} />
            </div>
            <span className="font-medium text-sm text-zinc-200">Travel Mode</span>
          </Link>

          <Link
            href="/coach"
            className="bg-[var(--palenight-surface)] p-4 rounded-xl shadow-lg border border-white/5 flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-[var(--palenight-accent)]/20 rounded-full flex items-center justify-center text-[var(--palenight-accent)]">
              <MessageSquare size={20} />
            </div>
            <span className="font-medium text-sm text-zinc-200">Coach Chat</span>
          </Link>

          <Link
            href="/analytics"
            className="bg-[var(--palenight-surface)] p-4 rounded-xl shadow-lg border border-white/5 flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-[var(--palenight-secondary)]/20 rounded-full flex items-center justify-center text-[var(--palenight-secondary)]">
              <BarChart2 size={20} />
            </div>
            <span className="font-medium text-sm text-zinc-200">Trends</span>
          </Link>

          <Link
            href="/history"
            className="bg-[var(--palenight-surface)] p-4 rounded-xl shadow-lg border border-white/5 flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
              <History size={20} />
            </div>
            <span className="font-medium text-sm text-zinc-200">Audit Log</span>
          </Link>

          <Link
            href="/social"
            className="bg-[var(--palenight-surface)] p-4 rounded-xl shadow-lg border border-white/5 flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-yellow-900/20 rounded-full flex items-center justify-center text-yellow-500">
              <Globe size={20} />
            </div>
            <span className="font-medium text-sm text-zinc-200">Rankings</span>
          </Link>

          <Link
            href="/planner"
            className="col-span-2 bg-[var(--palenight-accent)]/10 p-4 rounded-xl shadow-lg border border-[var(--palenight-accent)]/20 flex items-center justify-center gap-3 hover:bg-[var(--palenight-accent)]/20 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-[var(--palenight-accent)]/30 rounded-full flex items-center justify-center text-[var(--palenight-accent)]">
              <BookOpen size={20} />
            </div>
            <span className="font-semibold text-[var(--palenight-accent)]">Metabolic Planner (AI)</span>
          </Link>
        </motion.div>
      </motion.main>
    </div>
  );
}
