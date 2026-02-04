'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NutrientRadar } from '@/components/viz/NutrientRadar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type WeeklyStats = {
  protein_avg: number;
  carbs_avg: number;
  fats_avg: number;
  total_calories: number;
  log_count: number;
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadMetrics() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch last 7 days of logs
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: logs, error } = await supabase
        .from('logs')
        .select('grams, metabolic_tags_json')
        .eq('user_id', user.id)
        .gte('captured_at', sevenDaysAgo.toISOString());

      if (error || !logs) {
        console.error("Analytics Load Error", error);
        setLoading(false);
        return;
      }

      // Aggregation Logic
      let p = 0, c = 0, f = 0, cal = 0;
      
      logs.forEach((log: any) => {
        const macros = log.metabolic_tags_json || {}; 
        p += Number(macros.protein || 0);
        c += Number(macros.carbs || 0);
        f += Number(macros.fats || 0);
        cal += Number(macros.calories || 0);
      });

      const count = logs.length || 1; // Avoid divide by zero
      // Calculate daily averages (divide by 7, or by active days?)
      // Standard analytics usually divides by window size (7) for "Daily Avg"
      const windowSize = 7;
      
      setStats({
        protein_avg: Math.round(p / windowSize),
        carbs_avg: Math.round(c / windowSize),
        fats_avg: Math.round(f / windowSize),
        total_calories: Math.round(cal / windowSize),
        log_count: logs.length
      });
      setLoading(false);
    }

    loadMetrics();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Calculating Metabolic Trends...</div>;

  return (
    <div className="min-h-screen bg-palenight-bg p-6 pb-24 space-y-6 max-w-lg mx-auto text-zinc-100">
      <h1 className="text-2xl font-bold text-white">Metabolic Trends</h1>
      
      {/* 1. Macro Radar */}
      <Card className="bg-palenight-surface border-white/5 shadow-xl">
        <CardHeader>
          <div className="text-sm font-semibold text-zinc-400">7-Day Rolling Average</div>
        </CardHeader>
        <CardContent>
          {stats ? (
            <NutrientRadar 
              macros={[
                { label: 'Protein', current: stats.protein_avg, target: 180, color: 'bg-palenight-secondary' },
                { label: 'Carbs', current: stats.carbs_avg, target: 250, color: 'bg-palenight-success' },
                { label: 'Fats', current: stats.fats_avg, target: 70, color: 'bg-palenight-warning' },
              ]} 
            />
          ) : (
             <div className="h-40 flex items-center justify-center text-sm text-gray-400">No Data</div>
          )}
        </CardContent>
      </Card>

      {/* 2. Key Insights Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-palenight-surface p-4 rounded-xl border border-white/5 shadow-lg">
           <div className="text-xs text-zinc-500 uppercase font-bold">Daily Load</div>
           <div className="text-2xl font-bold mt-1 text-white">{stats?.total_calories} <span className="text-sm font-normal text-zinc-500">kcal</span></div>
        </div>
        <div className="bg-palenight-surface p-4 rounded-xl border border-white/5 shadow-lg">
           <div className="text-xs text-zinc-500 uppercase font-bold">Adherence</div>
           <div className="text-2xl font-bold mt-1 text-white">{stats?.log_count} <span className="text-sm font-normal text-zinc-500">logs</span></div>
        </div>
      </div>
    </div>
  );
}
