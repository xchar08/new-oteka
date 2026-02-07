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
             if (data.error) {
               setAdvice(`Advisor Error: ${data.error}`);
               console.error('Advisor Logic Error:', data.error);
             } else {
                // Formatting Fix: Strip markdown styling robustly
                const cleaning = (data.advice || 'Metabolic state nominal.')
                   .replace(/[\*\_\#\>]/g, '') 
                   .replace(/\[.*?\]/g, '') 
                   .replace(/^\s*[-•]\s*/gm, '• ') 
                   .trim();
                setAdvice(cleaning);
              }
           } else {
             console.error('Advisor Function Error:', error);
             setAdvice(`System Error: ${error?.message || 'Connection failed'}`);
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
    <div className="min-h-screen bg-background pb-32 text-foreground">
      {/* Header */}
      <header className="bg-surface pt-safe p-6 pb-8 rounded-b-[2.5rem] shadow-sm space-y-6 border-b border-white/5 relative z-10">
         {/* ... (keep existing header content) ... */}
         <div className="flex justify-between items-start mt-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Good Morning</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-foreground-muted text-sm font-medium">
                Streak: <span className="text-primary">{user?.streak_count || 0} Days</span>
              </p>
              {!isOnline && (
                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  OFFLINE
                </span>
              )}
            </div>
          </div>
          <div className="bg-primary/10 text-primary border border-primary/20 px-4 py-1.5 rounded-full text-xs font-bold capitalize shadow-sm">
            {user?.metabolic_state_json?.current_goal || 'Maintenance'}
          </div>
        </div>

        {/* Agentic Advice Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-surface to-surface/50 border border-white/5 p-6 rounded-2xl relative overflow-hidden shadow-lg"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_10px_var(--secondary)]" />
            <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">
              Metabolic Advisor
            </div>
          </div>
          <div className="relative z-10 pr-4">
            <p className="text-zinc-300 text-sm leading-relaxed font-normal">
              {advice}
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 opacity-[0.03] rotate-12 pointer-events-none">
            <BookOpen size={120} />
          </div>
        </motion.div>

        {/* Active Conditions */}
        {activeConditions.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {activeConditions.map((c) => (
              <span
                key={c}
                className="text-[10px] uppercase tracking-wide px-3 py-1.5 bg-red-500/10 text-red-300 border border-red-500/20 rounded-lg font-bold"
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
        className="px-6 py-8 space-y-8"
      >
        {/* Viz */}
        <motion.div variants={item} className="bg-surface p-5 rounded-2xl shadow-sm border border-white/5">
          <div className="flex items-center justify-between mb-6">
               <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                 Nutrient Targeting
               </h3>
               <span className="text-xs text-zinc-600 font-medium">Daily Goals</span>
          </div>
          
          {/* ... radar content ... */}
          {NutrientRadar ? (
            <div className="py-2">
                <NutrientRadar
                macros={[
                    {
                    label: 'Protein',
                    current: 120,
                    target: 180,
                    color: 'bg-secondary',
                    },
                    {
                    label: 'Carbs',
                    current: 150,
                    target: 250,
                    color: 'bg-success',
                    },
                    {
                    label: 'Fats',
                    current: 45,
                    target: 70,
                    color: 'bg-warning',
                    },
                ]}
                />
            </div>
          ) : (
            <div className="h-40 bg-zinc-900/50 rounded-xl flex items-center justify-center text-zinc-600 text-xs font-mono">
              Radar Placeholder
            </div>
          )}
        </motion.div>

        {/* Quick Actions Grid */}
        <div className="space-y-4">
            <motion.h3 variants={item} className="font-bold text-zinc-500 text-xs uppercase tracking-widest px-1">Actions</motion.h3>
            <motion.div variants={item} className="grid grid-cols-2 gap-4">
            <Link
                href="/log"
                className="group bg-surface p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col items-start justify-between gap-4 hover:bg-white/5 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary group-hover:scale-110 transition-transform duration-300">
                <Camera size={24} />
                </div>
                <div>
                     <span className="block font-semibold text-base text-foreground group-hover:text-secondary transition-colors">Vision Log</span>
                     <span className="text-[10px] text-zinc-500 font-medium">Snap & Track</span>
                </div>
            </Link>

            <Link
                href="/pantry"
                className="group bg-surface p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col items-start justify-between gap-4 hover:bg-white/5 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center text-success group-hover:scale-110 transition-transform duration-300">
                <BookOpen size={24} />
                </div>
                <div>
                     <span className="block font-semibold text-base text-foreground group-hover:text-success transition-colors">Pantry</span>
                     <span className="text-[10px] text-zinc-500 font-medium">Manage Stock</span>
                </div>
            </Link>

            <Link
                href="/shopping"
                className="group bg-surface p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col items-start justify-between gap-4 hover:bg-white/5 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                <ShoppingCart size={24} />
                </div>
                <div>
                     <span className="block font-semibold text-base text-foreground group-hover:text-primary transition-colors">Shopping</span>
                     <span className="text-[10px] text-zinc-500 font-medium">Auto-List</span>
                </div>
            </Link>

            <Link
                href="/travel/menu"
                className="group bg-surface p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col items-start justify-between gap-4 hover:bg-white/5 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center text-warning group-hover:scale-110 transition-transform duration-300">
                <Plane size={24} />
                </div>
                <div>
                     <span className="block font-semibold text-base text-foreground group-hover:text-warning transition-colors">Travel Mode</span>
                     <span className="text-[10px] text-zinc-500 font-medium">Airport & Dining</span>
                </div>
            </Link>

            <Link
                href="/coach"
                className="bg-surface p-5 rounded-2xl shadow-sm border border-white/5 flex items-center justify-center gap-3 hover:bg-white/5 transition active:scale-[0.98] col-span-2"
            >
                <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                  <MessageSquare size={16} />
                </div>
                <span className="font-semibold text-zinc-400 text-sm">Ask Coach...</span>
            </Link>
            </motion.div>
        </div>
      </motion.main>
    </div>
  );
}
