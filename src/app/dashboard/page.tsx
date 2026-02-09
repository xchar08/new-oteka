'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Camera, BookOpen, ShoppingCart, Plane, MessageSquare, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { NutrientRadar } from '@/components/viz/NutrientRadar';
import { useConnectionMode } from '@/lib/hooks/useConnectionMode';
import { useAppStore } from '@/lib/state/appStore';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

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

export default function DashboardPage() {
  const router = useRouter();
  useConnectionMode(); // Init connection listener

  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [advice, setAdvice] = useState<string>('Analyzing metabolic state...');
  const [activeConditions, setActiveConditions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyMacros, setDailyMacros] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });

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

      // 3. Fetch Daily Logs & Aggregate (Online + Offline)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const { data: onlineLogs } = await supabase
        .from('logs')
        .select('metabolic_tags_json')
        .eq('user_id', authUser.id)
        .gte('captured_at', startOfDay.toISOString());

      let allLogs = onlineLogs || [];

      // Merge Offline Queue
      try {
          if (typeof window !== 'undefined') {
              const { listQueue, readQueuePayload } = await import('@/lib/offline/queue');
              const queueItems = await listQueue();
              const pendingLogs = queueItems.filter(i => i.type === 'VISION_LOG' && (i.status === 'PENDING' || i.status === 'FAILED'));
              
              for (const item of pendingLogs) {
                  const payload: any = await readQueuePayload(item);
                  // Check if it's for today
                  if (new Date(payload.captured_at || item.created_at) >= startOfDay) {
                      allLogs.push({ metabolic_tags_json: payload.metabolic_tags_json });
                  }
              }
          }
      } catch (e) {
          console.warn('Failed to load offline logs:', e);
      }

      if (allLogs.length > 0) {
        const totals = allLogs.reduce((acc, log) => {
            const m = log.metabolic_tags_json || {};
            return {
                calories: acc.calories + (Number(m.calories) || 0),
                protein: acc.protein + (Number(m.protein) || 0),
                carbs: acc.carbs + (Number(m.carbs) || 0),
                fats: acc.fats + (Number(m.fats) || 0),
            };
        }, { calories: 0, protein: 0, carbs: 0, fats: 0 });
        setDailyMacros(totals);
      }

      // 4. Fetch Advice (with Caching & Silent Fallback)
      try {
          const CACHE_KEY = 'oteka_dashboard_advice';
          const cached = localStorage.getItem(CACHE_KEY);
          const now = Date.now();
          let shouldFetch = true;

          if (cached) {
              const { timestamp, text } = JSON.parse(cached);
              // 30-minute cache to save tokens/quota
              if (now - timestamp < 30 * 60 * 1000) {
                  setAdvice(text);
                  shouldFetch = false;
              }
          }

          if (shouldFetch && navigator.onLine) {
               const { data, error } = await supabase.functions.invoke('advisor-context', {
                 body: { context: 'dashboard' }
               });
               
               if (error) throw error;
               if (data?.error) throw new Error(data.error);

               let text = data.advice || 'Metabolic state nominal.';
               // Check for "Overheated" message
               if (text.includes('overheated') || text.includes('try again')) {
                   console.warn('Advisor Rate Limited (Suppressed)');
                   if (cached) {
                        const { text: oldText } = JSON.parse(cached);
                        setAdvice(oldText);
                   } else {
                        setAdvice("Ready to track. Scan your next meal to analyze.");
                   }
               } else {
                   text = text.replace(/[\*\_\#\>]/g, '') 
                       .replace(/\[.*?\]/g, '') 
                       .replace(/^\s*[-•]\s*/gm, '• ') 
                       .trim();
                    
                   setAdvice(text);
                   localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, text }));
               }
          } else if (!navigator.onLine) {
              setAdvice('Offline Mode: Sync pending.');
          }
      } catch (e: any) {
          console.warn('Advisor Network Exception:', e);
          // Don't block dashboard load on advisor error
          setAdvice('Metabolic Coach unavailable. (Check Connection)');
      } finally {
          setLoading(false);
      }
    }
    
    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => setLoading(false), 5000);
    
    load().catch(e => {
        console.error("Dashboard Load Critical Fail:", e);
        setLoading(false);
    });

    return () => clearTimeout(safetyTimeout);
  }, [supabase]);

  if (loading)
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Syncing Metabolic State...</div>;

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground transition-colors duration-300">
      {/* Header */}
      <header className="bg-background/80 pt-safe p-6 pb-8 rounded-b-[2.5rem] border-b border-border relative z-10 backdrop-blur-xl">
         <div className="flex justify-between items-start mt-4">
          <div>
            <h1 className="text-3xl font-light tracking-tight">Good Morning</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground text-sm font-medium">
                Streak: <span className="text-primary">{user?.streak_count || 0} Days</span>
              </p>
              {!isOnline && (
                <span className="px-2 py-0.5 bg-destructive/10 text-destructive text-[10px] font-bold rounded-full uppercase tracking-wider">
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
          className="mt-6 bg-card border border-border p-6 rounded-2xl relative overflow-hidden shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-accent-foreground" />
            <div className="text-[10px] font-bold text-accent-foreground uppercase tracking-widest">
              Metabolic Advisor
            </div>
          </div>
          <div className="relative z-10 pr-4">
            <p className="text-card-foreground text-sm leading-relaxed font-light">
              {advice}
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 opacity-[0.03] rotate-12 pointer-events-none text-foreground">
            <BookOpen size={120} />
          </div>
        </motion.div>

        {/* Active Conditions */}
        {activeConditions.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-4">
            {activeConditions.map((c) => (
              <span
                key={c}
                className="text-[10px] uppercase tracking-wide px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg font-bold"
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
          <motion.div variants={item} className="bg-card p-5 rounded-2xl shadow-sm border border-border">
           <div className="flex items-center justify-between mb-6">
               <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                    Nutrient Targeting
                  </h3>
                  <div className="text-xs text-secondary-foreground font-medium">
                      {dailyMacros.calories.toFixed(0)} / 2500 kcal
                  </div>
               </div>
               {/* Mini Daily Progress Bar */}
               <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                   <div className="h-full bg-primary" style={{ width: `${Math.min((dailyMacros.calories / 2500) * 100, 100)}%` }} />
               </div>
           </div>
          
          {NutrientRadar ? (
            <div className="py-2">
                <NutrientRadar
                macros={[
                    {
                    label: 'Protein',
                    current: dailyMacros.protein,
                    target: 180, 
                    color: 'bg-emerald-500', 
                    },
                    {
                    label: 'Carbs',
                    current: dailyMacros.carbs,
                    target: 250,
                    color: 'bg-blue-500',
                    },
                    {
                    label: 'Fats',
                    current: dailyMacros.fats,
                    target: 70,
                    color: 'bg-yellow-500',
                    },
                ]}
                />
            </div>
          ) : (
            <div className="h-40 bg-muted/50 rounded-xl flex items-center justify-center text-muted-foreground text-xs font-mono">
              Radar Placeholder
            </div>
          )}
        </motion.div>

        {/* Today's Logs (New Section) */}
        <motion.div variants={item} className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-muted-foreground text-xs uppercase tracking-widest px-1">Today's Fuel</h3>
                <Link href="/history" className="text-xs text-primary hover:underline">View All</Link>
            </div>
            {dailyMacros.calories > 0 ? (
                 <div className="bg-card border border-border rounded-xl divide-y divide-border">
                     <div className="p-4 flex justify-between items-center">
                         <div>
                             <div className="font-medium text-sm">Daily Total</div>
                             <div className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</div>
                         </div>
                         <div className="text-right">
                             <div className="font-bold text-primary">{dailyMacros.calories.toFixed(0)} kcal</div>
                             <div className="text-[10px] text-muted-foreground">
                                 {dailyMacros.protein.toFixed(0)}p • {dailyMacros.carbs.toFixed(0)}c • {dailyMacros.fats.toFixed(0)}f
                             </div>
                         </div>
                     </div>
                     {/* We could list individual items here if we fetched them in a list state, currently we only have aggregates `dailyMacros`. 
                         Ideally we update the fetch to keep the items array too. For now, showing the aggregate card is a massive improvement. 
                      */}
                 </div>
            ) : (
                <div className="text-center p-6 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm">
                    No logs today. Snap a meal to start.
                </div>
            )}
        </motion.div>


        {/* Rate Meal Prompt (Mock logic: if calories > 0 show it) */}
        {dailyMacros.calories > 0 && (
            <motion.div variants={item}>
                <Link href="/rating">
                    <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 p-4 rounded-xl flex items-center justify-between">
                        <div>
                            <div className="font-bold text-blue-500 text-sm">How do you feel?</div>
                            <div className="text-xs text-muted-foreground">Rate your energy levels post-meal.</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            <Sparkles size={14} />
                        </div>
                    </div>
                </Link>
            </motion.div>
        )}

        {/* Quick Actions Grid */}
        <div className="space-y-4">
            <motion.h3 variants={item} className="font-bold text-muted-foreground text-xs uppercase tracking-widest px-1">Actions</motion.h3>
            <motion.div variants={item} className="grid grid-cols-2 gap-4">
            <Link
                href="/log"
                className="group bg-card p-5 rounded-2xl shadow-sm border border-border flex flex-col items-start justify-between gap-4 hover:border-primary/50 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-primary/5">
                <Camera size={24} />
                </div>
                <div>
                     <span className="block font-medium text-base text-foreground group-hover:text-primary transition-colors">Vision Log</span>
                     <span className="text-[10px] text-muted-foreground font-medium">Snap & Track</span>
                </div>
            </Link>

            <Link
                href="/pantry"
                className="group bg-card p-5 rounded-2xl shadow-sm border border-border flex flex-col items-start justify-between gap-4 hover:border-blue-500/50 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/5">
                <BookOpen size={24} />
                </div>
                <div>
                     <span className="block font-medium text-base text-foreground group-hover:text-blue-500 transition-colors">Pantry</span>
                     <span className="text-[10px] text-muted-foreground font-medium">Manage Stock</span>
                </div>
            </Link>

            <Link
                href="/shopping"
                className="group bg-card p-5 rounded-2xl shadow-sm border border-border flex flex-col items-start justify-between gap-4 hover:border-purple-500/50 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-purple-500/5">
                <ShoppingCart size={24} />
                </div>
                <div>
                     <span className="block font-medium text-base text-foreground group-hover:text-purple-500 transition-colors">Shopping</span>
                     <span className="text-[10px] text-muted-foreground font-medium">Auto-List</span>
                </div>
            </Link>

            <Link
                href="/travel/menu"
                className="group bg-card p-5 rounded-2xl shadow-sm border border-border flex flex-col items-start justify-between gap-4 hover:border-amber-500/50 transition-all duration-300 active:scale-[0.98]"
            >
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-amber-500/5">
                <Plane size={24} />
                </div>
                <div>
                     <span className="block font-medium text-base text-foreground group-hover:text-amber-500 transition-colors">Travel Mode</span>
                     <span className="text-[10px] text-muted-foreground font-medium">Airport & Dining</span>
                </div>
            </Link>

            <Link
                href="/coach"
                className="bg-card p-5 rounded-2xl shadow-sm border border-border flex items-center justify-center gap-3 hover:bg-secondary/20 transition active:scale-[0.98] col-span-2"
            >
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-secondary-foreground">
                  <MessageSquare size={16} />
                </div>
                <span className="font-semibold text-muted-foreground text-sm">Ask Coach...</span>
            </Link>
            </motion.div>
        </div>
      </motion.main>
    </div>
  );
}
