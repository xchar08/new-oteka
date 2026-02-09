'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import { Loader2, Calendar, ChevronRight } from 'lucide-react';

export default function HistoryPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: onlineLogs } = await supabase
        .from('logs')
        .select('*')
        .order('captured_at', { ascending: false })
        .limit(20);
      
      let allLogs = onlineLogs || [];

      // Merge Offline Queue
      try {
          if (typeof window !== 'undefined') {
              const { listQueue, readQueuePayload } = await import('@/lib/offline/queue');
              const queueItems = await listQueue();
              const pendingLogs = queueItems.filter(i => i.type === 'VISION_LOG' && (i.status === 'PENDING' || i.status === 'FAILED'));
              
              const offlineEntries = [];
              for (const item of pendingLogs) {
                  const payload: any = await readQueuePayload(item);
                  offlineEntries.push({
                      id: `temp-${item.id}`, // Temp ID
                      captured_at: payload.captured_at || item.created_at,
                      metabolic_tags_json: payload.metabolic_tags_json,
                      is_offline: true,
                      status: item.status
                  });
              }
              // Merge and Sort
              allLogs = [...offlineEntries, ...allLogs].sort((a, b) => 
                  new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
              );
          }
      } catch (e) {
          console.warn('Failed to load offline logs:', e);
      }
      
      setLogs(allLogs);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6 space-y-6 pb-32 text-foreground">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nutrition History</h1>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            {logs.length} Entries
        </div>
      </header>
      
      <div className="space-y-3">
        {logs.map(log => (
            <LogItem key={log.id} log={log} />
        ))}

        {logs.length === 0 && !loading && (
            <div className="text-center py-10 text-muted-foreground text-sm">
                No logs found. Start tracking!
            </div>
        )}
      </div>
    </div>
  );
}

function LogItem({ log }: { log: any }) {
    const [expanded, setExpanded] = useState(false);
    const meta = log.metabolic_tags_json || {};
    const macros = meta.macros || {};
    // Fallback: check both 'food_name' (AI log) and 'item' (Client log) keys
    const name = meta.food_name || meta.item || 'Unknown Food';
    const ingredients = meta.ingredients || [];

    return (
        <div 
            onClick={() => setExpanded(!expanded)}
            className="bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all duration-300 active:scale-[0.99] cursor-pointer"
        >
            <div className="p-4 flex items-center justify-between">
                <div>
                        <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-base capitalize">{name}</span>
                        <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded font-bold uppercase">
                            {formatDate(log.captured_at).split(',')[0]}
                        </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                        {macros.calories?.toFixed(0) || meta.calories?.toFixed(0) || 0} kcal • {macros.protein?.toFixed(0) || meta.protein?.toFixed(0) || 0}g Pro
                        </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-xl font-light tabular-nums text-primary">
                        {macros.calories?.toFixed(0) || meta.calories?.toFixed(0) || 0}
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`} />
                </div>
            </div>
            
            {/* Scaffolding View */}
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? 'grid-rows-[1fr] border-t border-border' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden bg-secondary/5">
                    <div className="p-4 pt-2">
                        <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Molecular Scaffolding</h4>
                        {ingredients.length > 0 ? (
                            <div className="space-y-1">
                                {ingredients.map((ing: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <span className="text-foreground/80 capitalize">{ing.name}</span>
                                        <span className="text-xs font-mono text-muted-foreground">{(ing.ratio * 100).toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground italic">
                                No scaffolding data available for this log.
                            </div>
                        )}
                    </div>

                    {/* Micronutrients View */}
                    <div className="p-4 pt-2 border-t border-border/10">
                        <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Micros & Vitamins</h4>
                        {(meta.micros && meta.micros.length > 0) ? (
                            <div className="grid grid-cols-2 gap-2">
                                {meta.micros.map((micro: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center text-sm bg-background/50 p-2 rounded border border-border/50">
                                        <span className="text-foreground/80 capitalize text-xs">{micro.name}</span>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-mono font-medium">{micro.amount}</span>
                                            {micro.daily_value_pct && <span className="text-[9px] text-muted-foreground">{micro.daily_value_pct}% DV</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground italic">
                                No micronutrient data available.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
