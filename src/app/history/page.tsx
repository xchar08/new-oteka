'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ChevronRight, UtensilsCrossed, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';

export default function HistoryPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['daily-logs-history'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from('logs')
        .select('*')
        .order('captured_at', { ascending: false })
        .limit(50);
      
      return data || [];
    }
  });

  // Group logs by date
  const groupedLogs = mounted ? logs.reduce((acc: Record<string, any[]>, log) => {
    const dateKey = new Date(log.captured_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(log);
    return acc;
  }, {}) : {};

  if (isLoading || !mounted) return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        <span className="text-[var(--text-secondary)] text-sm font-medium">Syncing history...</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-app)] p-6 pb-32 text-[var(--text-primary)] transition-colors duration-500">
      
      <header className="flex items-center gap-4 pt-safe mb-8">
        <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <div>
           <h1 className="text-3xl font-light tracking-tight mb-1">History</h1>
           <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
             <UtensilsCrossed className="h-4 w-4" />
             <span>{logs.length} total meals</span>
           </div>
        </div>
      </header>
       
      <div className="space-y-8 relative z-10">
        {logs.length === 0 ? (
          <div className="text-center py-20 bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-[32px]">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[var(--bg-app)] mb-4 border border-[var(--border)]">
              <UtensilsCrossed className="text-[var(--text-secondary)] opacity-30 h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">No history yet</h3>
            <p className="text-[var(--text-secondary)] mt-2">Start your journey today.</p>
            <button 
               onClick={() => router.push('/log')}
               className="mt-6 px-8 py-3 bg-[var(--primary)] text-white rounded-2xl font-bold shadow-lg"
            >
              Log First Meal
            </button>
          </div>
        ) : (
          Object.entries(groupedLogs).map(([date, dateLogs]) => (
            <section key={date}>
              <div className="flex items-center gap-2 mb-4 ml-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">{date}</h3>
              </div>
              <div className="space-y-3">
                {dateLogs.map((log: any) => (
                  <LogItem key={log.id} log={log} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function LogItem({ log }: { log: any }) {
    const [expanded, setExpanded] = useState(false);
    const meta = log.metabolic_tags_json || {};
    const macros = meta.macros || meta || {};
    const name = meta.food_name || meta.item || 'Unknown Food';
    const ingredients = meta.ingredients || [];

    return (
        <motion.div 
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setExpanded(!expanded)}
            className={`bg-[var(--bg-surface)] border border-[var(--border)] rounded-[28px] overflow-hidden transition-all duration-300 active:scale-[0.99] cursor-pointer shadow-sm`}
        >
            <div className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[var(--text-primary)] capitalize truncate block">{name}</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-2 font-bold uppercase tracking-wider">
                        <span>{Number(macros.calories || 0).toFixed(0)} kcal</span>
                        <div className="w-1 h-1 bg-[var(--border)] rounded-full" />
                        <span>{Number(macros.protein || 0).toFixed(0)}g protein</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-xl font-black text-[var(--primary)] tabular-nums">
                        {Number(macros.calories || 0).toFixed(0)}
                    </div>
                    <div className={`p-1.5 rounded-full bg-[var(--bg-app)] border border-[var(--border)] transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}>
                        <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
                    </div>
                </div>
            </div>
            
            <AnimatePresence>
                {expanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[var(--border)]"
                    >
                        <div className="p-5 bg-[var(--bg-app)]/50 space-y-5">
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Protein', val: macros.protein },
                                    { label: 'Carbs', val: macros.carbs },
                                    { label: 'Fat', val: macros.fats || macros.fat },
                                ].map(m => (
                                    <div key={m.label} className={`bg-[var(--bg-surface)] border border-[var(--border)] p-3 rounded-2xl`}>
                                        <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-widest font-black mb-1">{m.label}</div>
                                        <div className={`text-base font-black text-[var(--text-primary)]`}>{Number(m.val || 0).toFixed(0)}<span className="text-[10px] text-[var(--text-secondary)] ml-1 font-bold">g</span></div>
                                    </div>
                                ))}
                            </div>

                            {ingredients.length > 0 && (
                                <div>
                                    <h4 className="text-[9px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-3 ml-1">Key Components</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {ingredients.map((ing: any, i: number) => (
                                            <span key={i} className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] font-medium capitalize shadow-sm">{ing.name || ing}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
