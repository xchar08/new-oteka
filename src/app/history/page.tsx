'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { visionService } from '@/lib/services/vision.service';
import { Loader2, UtensilsCrossed, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { LogEntryCard } from '@/components/pantry/LogEntryCard';
import type { LogEntry } from '@/lib/types/metabolic';

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
      
      return visionService.resolveLogImages(data || []) as Promise<LogEntry[]>;
    }
  });

  // Group logs by date
  const groupedLogs = mounted ? logs.reduce((acc: Record<string, LogEntry[]>, log) => {
    // Split local_date to prevent JS from assuming UTC midnight
    const localDate = log.local_date || new Date().toLocaleDateString('en-CA');
    const [y, m, d] = localDate.split('-');
    const dateKey = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    });
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
               onClick={() => router.push('/vision')}
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
                {dateLogs.map((log: LogEntry) => (
                  <LogEntryCard key={log.id} log={log} />
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
