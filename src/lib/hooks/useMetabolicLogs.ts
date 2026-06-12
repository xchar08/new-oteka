'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { visionService } from '@/lib/services/vision.service';
import { useAppStore } from '@/lib/state/appStore';
import { normalizeError } from '@/lib/utils/errors';
import { aggregateNutrients } from '@/lib/utils/metabolic.utils';
import type { DashboardMacros, LogEntry } from '@/lib/types/metabolic';
import { get, set, del } from 'idb-keyval';
import { useUser } from './useUser';

export function useMetabolicLogs() {
  const supabase = createClient();
  const isOnline = useAppStore((s) => s.isOnline);
  const { authUser } = useUser();

  const { data: dailyLogs = [], isLoading: isLogsLoading, isError: isLogsError, refetch: refetchLogs } = useQuery({
    queryKey: ['daily-logs', authUser?.id],
    queryFn: async () => {
      if (!authUser) return [];
      const dbLogs = await visionService.getDailyLogs(authUser.id);
      
      // Merge optimistic offline captures if present
      let queue = await get('pending_captures_queue') || [];
      const legacyPending = await get('pending_capture');
      
      // Migrate legacy single pending_capture to the queue
      if (legacyPending && legacyPending.blob && legacyPending.userId === authUser.id) {
        queue = [{
          id: 'legacy-migration',
          blob: legacyPending.blob,
          userId: legacyPending.userId,
          timestamp: legacyPending.timestamp || Date.now()
        }, ...queue];
        await set('pending_captures_queue', queue);
        await del('pending_capture');
      }

      if (queue.length > 0) {
        const optimisticLogs: LogEntry[] = queue
          .filter((item: any) => item && item.userId === authUser.id)
          .map((item: any, index: number) => ({
            id: `optimistic-pending-${item.id || index}`,
            user_id: authUser.id,
            grams: 0,
            local_date: new Date().toLocaleDateString('en-CA'),
            captured_at: new Date(item.timestamp || Date.now()).toISOString(),
            metabolic_tags_json: {
              item: 'Pending Sync...',
              calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0,
              vitamins: [], minerals: [], micros: [], ingredients: [], image_path: null, isOptimistic: true
            }
          }));
        return [...optimisticLogs, ...dbLogs];
      }
      return dbLogs;
    },
    enabled: !!authUser,
    staleTime: 1000 * 60 * 5, // 5 minutes cache to prevent rapid refetching
  });

  const dailyMacros: DashboardMacros = dailyLogs.reduce((acc: DashboardMacros, log: LogEntry) => {
    const m = (log.metabolic_tags_json || {}) as Record<string, any>;
    return {
      calories: acc.calories + (Number(m.calories) || 0),
      protein: acc.protein + (Number(m.protein) || 0),
      carbs: acc.carbs + (Number(m.carbs) || 0),
      fat: acc.fat + (Number(m.fat || m.fats) || 0),
      fiber: acc.fiber + (Number(m.fiber) || 0),
      sugar: acc.sugar + (Number(m.sugar) || 0),
      sodium: acc.sodium + (Number(m.sodium) || 0),
      cholesterol: acc.cholesterol + (Number(m.cholesterol) || 0),
      vitamins: aggregateNutrients(acc.vitamins || {}, m.vitamins || []),
      minerals: aggregateNutrients(acc.minerals || {}, m.minerals || []),
    };
  }, { 
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0,
    vitamins: {},
    minerals: {}
  });

  const { data: advice = 'Analyzing metabolic state...', isLoading: isAdviceLoading, isError: isAdviceError } = useQuery({
    queryKey: ['metabolic-advice', authUser?.id],
    queryFn: async () => {
      if (!navigator.onLine) return 'Offline Mode: Sync pending.';
      // We pass the calculated macros and recent logs directly to save the Edge Function a DB query
      const { data, error } = await supabase.functions.invoke('advisor-context', {
        body: { 
          context: 'dashboard', 
          dailyTotals: dailyMacros,
          recentLogs: dailyLogs.slice(0, 5)
        }
      });
      if (error) throw normalizeError(error);
      return data?.advice || 'Metabolic state nominal.';
    },
    staleTime: 1000 * 60 * 30,
    enabled: !!authUser && isOnline && !isLogsLoading,
  });

  return {
    dailyLogs,
    dailyMacros,
    // The advisor query is disabled offline, so say so instead of
    // showing "Analyzing..." forever
    advice: !isOnline ? 'Offline — the advisor returns when you reconnect.' : advice,
    adviceError: isAdviceError,
    logsError: isLogsError,
    refetchLogs,
    loading: isLogsLoading || isAdviceLoading
  };
}
