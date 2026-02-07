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

      const { data } = await supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (data) setLogs(data);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-palenight-bg p-6 space-y-6 pb-24 text-zinc-100">
      <h1 className="text-2xl font-bold text-white">Activity Log</h1>
      
      <div className="space-y-3">
        {logs.map(log => (
          <div key={log.id} className="bg-palenight-surface p-4 rounded-xl border border-white/5 shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-sm uppercase tracking-wide text-palenight-accent">
                {log.trigger_event.replace('_', ' ')}
              </span>
              <span className="text-xs text-zinc-500">{formatDate(log.created_at)}</span>
            </div>
            <div className="text-sm text-zinc-300">
              Status: <span className={log.last_run_status === 'success' ? 'text-palenight-success' : 'text-palenight-error'}>
                {log.last_run_status}
              </span>
            </div>
            {log.logs_json && (
              <pre className="mt-2 p-2 bg-palenight-bg border border-white/5 rounded text-[10px] overflow-x-auto text-zinc-400">
                {JSON.stringify(log.logs_json, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
