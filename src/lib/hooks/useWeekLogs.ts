'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { visionService } from '@/lib/services/vision.service';
import { normalizeError } from '@/lib/utils/errors';
import { get } from 'idb-keyval';
import { useUser } from './useUser';
import type { LogEntry } from '@/lib/types/metabolic';

function toLocalDateString(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

/**
 * Fetches all logs for one Monday-anchored week. Each week is its own
 * react-query cache entry, so paging back through history only hits the
 * network once per week. The current week also merges the offline
 * optimistic-capture queue, mirroring useMetabolicLogs.
 */
export function useWeekLogs(weekStart: Date, enabled: boolean = true) {
  const supabase = createClient();
  const { authUser } = useUser();

  const weekStartString = toLocalDateString(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndString = toLocalDateString(weekEnd);
  const todayString = toLocalDateString(new Date());
  const isCurrentWeek = weekStartString <= todayString && todayString <= weekEndString;

  const { data: weekLogs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['week-logs', authUser?.id, weekStartString],
    queryFn: async (): Promise<LogEntry[]> => {
      if (!authUser) return [];

      const { data, error } = await supabase
        .from('logs')
        .select('id, user_id, grams, metabolic_tags_json, captured_at, local_date')
        .eq('user_id', authUser.id)
        .gte('local_date', weekStartString)
        .lte('local_date', weekEndString)
        .order('captured_at', { ascending: false });

      if (error) throw normalizeError(error);
      const resolved = (await visionService.resolveLogImages(data || [])) as LogEntry[];

      if (!isCurrentWeek) return resolved;

      // Pending offline captures belong to today, i.e. the current week
      const queue = ((await get('pending_captures_queue')) || []) as Array<{
        id?: string; userId?: string; timestamp?: number;
      }>;
      if (queue.length === 0) return resolved;

      const optimistic: LogEntry[] = queue
        .filter((item) => item && item.userId === authUser.id)
        .map((item, index) => ({
          id: `optimistic-pending-${item.id || index}`,
          user_id: authUser.id,
          grams: 0,
          local_date: todayString,
          captured_at: new Date(item.timestamp || Date.now()).toISOString(),
          metabolic_tags_json: {
            item: 'Pending Sync...',
            calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0,
            vitamins: [], minerals: [], micros: [], ingredients: [], image_path: null, isOptimistic: true,
          },
        } as LogEntry));
      return [...optimistic, ...resolved];
    },
    enabled: !!authUser && enabled,
    staleTime: 1000 * 60 * 5,
  });

  return { weekLogs, loading: isLoading, error: isError, refetch };
}
