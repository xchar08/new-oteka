'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

export default function HistoryPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (data) setLogs(data);
    }
    load();
  }, []);

  return (
    <div className="p-6 space-y-6 pb-24">
      <h1 className="text-2xl font-bold">Activity Log</h1>
      
      <div className="space-y-3">
        {logs.map(log => (
          <div key={log.id} className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-sm uppercase tracking-wide text-blue-600">
                {log.trigger_event.replace('_', ' ')}
              </span>
              <span className="text-xs text-gray-400">{formatDate(log.created_at)}</span>
            </div>
            <div className="text-sm text-gray-700">
              Status: <span className={log.last_run_status === 'success' ? 'text-green-600' : 'text-red-600'}>
                {log.last_run_status}
              </span>
            </div>
            {log.logs_json && (
              <pre className="mt-2 p-2 bg-gray-50 rounded text-[10px] overflow-x-auto">
                {JSON.stringify(log.logs_json, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
