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
               setAdvice(data.advice || 'Metabolic state nominal.');
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
    <div className="min-h-screen bg-background pb-24 text-foreground">
      {/* Header */}
      <header className="bg-surface p-6 pb-8 rounded-b-3xl shadow-sm space-y-4 border-b border-white/5">
         {/* ... (keep existing header content) ... */}
         <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Good Morning</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-foreground-muted text-sm">
                Streak: {user?.streak_count || 0} Days
              </p>
              {!isOnline && (
                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs font-bold rounded-full">
                  OFFLINE
                </span>
              )}
            </div>
          </div>
          <div className="bg-primary/20 text-primary border border-primary/50 px-3 py-1 rounded-full text-xs font-bold capitalize">
            {user?.metabolic_state_json?.current_goal || 'Maintenance'}
          </div>
        </div>

        {/* Agentic Advice Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-background to-surface border border-secondary/30 p-5 rounded-2xl relative overflow-hidden shadow-xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <div className="text-xs font-bold text-secondary uppercase tracking-wide">
              Metabolic Advisor
            </div>
          </div>
          <div className="relative z-10 pr-8">
            <p className="text-foreground-muted text-sm font-medium leading-relaxed mb-2">
              {advice}
            </p>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
            <BookOpen size={96} className="text-secondary" />
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
        <motion.div variants={item} className="bg-surface p-4 rounded-xl shadow-lg border border-border">
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
          ) : (
            <div className="h-40 bg-background rounded flex items-center justify-center text-foreground-muted text-xs">
              Radar Placeholder
            </div>
          )}
        </motion.div>

        {/* Quick Actions Grid */}
        <motion.h3 variants={item} className="font-semibold text-foreground-muted">Actions</motion.h3>
        <motion.div variants={item} className="grid grid-cols-2 gap-4">
          <Link
            href="/log"
            className="bg-surface p-4 rounded-xl shadow-lg border border-border flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-secondary/20 rounded-full flex items-center justify-center text-secondary">
              <Camera size={20} />
            </div>
            <span className="font-medium text-sm text-foreground">Vision Log</span>
          </Link>

          <Link
            href="/pantry"
            className="bg-surface p-4 rounded-xl shadow-lg border border-border flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center text-success">
              <BookOpen size={20} />
            </div>
            <span className="font-medium text-sm text-foreground">Pantry</span>
          </Link>

          <Link
            href="/shopping"
            className="bg-surface p-4 rounded-xl shadow-lg border border-border flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary">
              <ShoppingCart size={20} />
            </div>
            <span className="font-medium text-sm text-foreground">Shopping</span>
          </Link>

          <Link
            href="/travel/menu"
            className="bg-surface p-4 rounded-xl shadow-lg border border-border flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-warning/20 rounded-full flex items-center justify-center text-warning">
              <Plane size={20} />
            </div>
            <span className="font-medium text-sm text-foreground">Travel Mode</span>
          </Link>

          <Link
            href="/coach"
            className="bg-surface p-4 rounded-xl shadow-lg border border-border flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary">
              <MessageSquare size={20} />
            </div>
            <span className="font-medium text-sm text-foreground">Coach Chat</span>
          </Link>

          <Link
            href="/analytics"
            className="bg-surface p-4 rounded-xl shadow-lg border border-border flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-secondary/20 rounded-full flex items-center justify-center text-secondary">
              <BarChart2 size={20} />
            </div>
            <span className="font-medium text-sm text-foreground">Trends</span>
          </Link>

          <Link
            href="/history"
            className="bg-surface p-4 rounded-xl shadow-lg border border-border flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
              <History size={20} />
            </div>
            <span className="font-medium text-sm text-foreground">Audit Log</span>
          </Link>

          <Link
            href="/social"
            className="bg-surface p-4 rounded-xl shadow-lg border border-border flex flex-col items-center justify-center gap-2 hover:brightness-110 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-yellow-900/20 rounded-full flex items-center justify-center text-yellow-500">
              <Globe size={20} />
            </div>
            <span className="font-medium text-sm text-foreground">Rankings</span>
          </Link>

          <Link
            href="/planner"
            className="col-span-2 bg-primary/10 p-4 rounded-xl shadow-lg border border-primary/20 flex items-center justify-center gap-3 hover:bg-primary/20 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-primary/30 rounded-full flex items-center justify-center text-primary">
              <BookOpen size={20} />
            </div>
            <span className="font-semibold text-primary">Metabolic Planner (AI)</span>
          </Link>
        </motion.div>
      </motion.main>
    </div>
  );
}
