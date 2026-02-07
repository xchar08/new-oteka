'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Camera, BookOpen, ShoppingCart, Plane, MessageSquare, History, BarChart2, Globe, Sparkles } from 'lucide-react';
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
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Syncing Metabolic State...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 pb-32 text-zinc-100">
      {/* Header */}
      <header className="bg-zinc-900/50 pt-safe p-6 pb-8 rounded-b-[2.5rem] border-b border-white/5 relative z-10 backdrop-blur-xl">
         <div className="flex justify-between items-start mt-4">
          <div>
            <h1 className="text-3xl font-light text-white tracking-tight">Good Morning</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-zinc-500 text-sm font-medium">
                Streak: <span className="text-emerald-400">{user?.streak_count || 0} Days</span>
              </p>
              {!isOnline && (
                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  OFFLINE
                </span>
              )}
            </div>
          </div>
          <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 rounded-full text-xs font-bold capitalize shadow-sm shadow-emerald-900/20">
            {user?.metabolic_state_json?.current_goal || 'Maintenance'}
          </div>
        </div>

        {/* Agentic Advice Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-gradient-to-br from-white/5 to-white/0 border border-white/10 p-6 rounded-2xl relative overflow-hidden shadow-lg"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
              Metabolic Advisor
            </div>
          </div>
          <div className="relative z-10 pr-4">
            <p className="text-zinc-200 text-sm leading-relaxed font-light">
              {advice}
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 opacity-[0.03] rotate-12 pointer-events-none text-white">
            <BookOpen size={120} />
          </div>
        </motion.div>

        {/* Active Conditions */}
        {activeConditions.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-4">
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
        <motion.div variants={item} className="bg-white/5 p-5 rounded-2xl shadow-sm border border-white/5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
               <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
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
                    current: 120, // Todo: Real Data
                    target: 180,
                    color: 'bg-emerald-500',
                    },
                    {
                    label: 'Carbs',
                    current: 150,
                    target: 250,
                    color: 'bg-blue-500',
                    },
                    {
                    label: 'Fats',
                    current: 45,
                    target: 70,
                    color: 'bg-yellow-500',
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
            <motion.h3 variants={item} className="font-bold text-zinc-600 text-xs uppercase tracking-widest px-1">Actions</motion.h3>
            <motion.div variants={item} className="grid grid-cols-2 gap-4">
            <Link
                href="/log"
                className="group bg-white/5 p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col items-start justify-between gap-4 hover:bg-white/10 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-emerald-500/5">
                <Camera size={24} />
                </div>
                <div>
                     <span className="block font-medium text-base text-zinc-100 group-hover:text-emerald-400 transition-colors">Vision Log</span>
                     <span className="text-[10px] text-zinc-500 font-medium">Snap & Track</span>
                </div>
            </Link>

            <Link
                href="/pantry"
                className="group bg-white/5 p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col items-start justify-between gap-4 hover:bg-white/10 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/5">
                <BookOpen size={24} />
                </div>
                <div>
                     <span className="block font-medium text-base text-zinc-100 group-hover:text-blue-400 transition-colors">Pantry</span>
                     <span className="text-[10px] text-zinc-500 font-medium">Manage Stock</span>
                </div>
            </Link>

            <Link
                href="/shopping"
                className="group bg-white/5 p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col items-start justify-between gap-4 hover:bg-white/10 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-purple-500/5">
                <ShoppingCart size={24} />
                </div>
                <div>
                     <span className="block font-medium text-base text-zinc-100 group-hover:text-purple-400 transition-colors">Shopping</span>
                     <span className="text-[10px] text-zinc-500 font-medium">Auto-List</span>
                </div>
            </Link>

            <Link
                href="/travel/menu"
                className="group bg-white/5 p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col items-start justify-between gap-4 hover:bg-white/10 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-amber-500/5">
                <Plane size={24} />
                </div>
                <div>
                     <span className="block font-medium text-base text-zinc-100 group-hover:text-amber-400 transition-colors">Travel Mode</span>
                     <span className="text-[10px] text-zinc-500 font-medium">Airport & Dining</span>
                </div>
            </Link>

            <Link
                href="/coach"
                className="bg-white/5 p-5 rounded-2xl shadow-sm border border-white/5 flex items-center justify-center gap-3 hover:bg-white/10 transition active:scale-[0.98] col-span-2"
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
