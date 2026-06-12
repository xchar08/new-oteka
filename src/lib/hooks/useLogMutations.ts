'use client';

import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { visionService } from '@/lib/services/vision.service';
import type { LogEntry } from '@/lib/types/metabolic';

// Every cache that holds log rows: today (gauge/calibration), paged weeks,
// and the History feed. Insights uses a manual effect and refreshes on its
// next tab visit.
function isLogQuery(key: QueryKey): boolean {
  return key[0] === 'daily-logs' || key[0] === 'week-logs' || key[0] === 'daily-logs-history';
}

function sortByCapturedAtDesc(logs: LogEntry[]): LogEntry[] {
  return [...logs].sort((a, b) => (b.captured_at || '').localeCompare(a.captured_at || ''));
}

/**
 * Optimistic edit/delete for logged meals, reconciled across all log caches.
 * Delete commits to the server immediately; the undo toast re-inserts the
 * row verbatim (sequenced after the delete settles, so they can't race).
 */
export function useLogMutations() {
  const queryClient = useQueryClient();

  const patchCaches = (mutate: (logs: LogEntry[]) => LogEntry[]) => {
    queryClient.setQueriesData<LogEntry[]>(
      { predicate: (q) => isLogQuery(q.queryKey) },
      (old) => (old ? mutate(old) : old)
    );
  };

  const updateLog = async (log: LogEntry, patch: { grams: number; metabolic_tags_json: Record<string, unknown> }) => {
    const logId = log.id;
    if (!logId) return false; // pending-sync rows have no server id yet
    const previous = log;
    patchCaches((logs) => logs.map((l) => (l.id === logId ? ({ ...l, ...patch } as LogEntry) : l)));
    try {
      await visionService.updateLog(logId, patch);
      return true;
    } catch (e) {
      patchCaches((logs) => logs.map((l) => (l.id === log.id ? previous : l)));
      toast.error("Couldn't save — your changes are still here");
      throw e;
    }
  };

  const deleteLogWithUndo = (log: LogEntry) => {
    const logId = log.id;
    if (!logId) return; // pending-sync rows have no server id yet
    patchCaches((logs) => logs.filter((l) => l.id !== logId));
    let undone = false;

    const deletion = visionService.deleteLog(logId).catch(() => {
      if (undone) return;
      patchCaches((logs) => sortByCapturedAtDesc([log, ...logs.filter((l) => l.id !== logId)]));
      toast.error("Couldn't delete — meal restored");
      throw new Error('delete-failed');
    });

    toast('Meal deleted', {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: async () => {
          undone = true;
          patchCaches((logs) => sortByCapturedAtDesc([log, ...logs.filter((l) => l.id !== logId)]));
          try {
            // Wait for the delete to settle before re-inserting, so the
            // restore can't be wiped by an in-flight delete
            await deletion.catch(() => { /* delete failed: row still exists */ });
            await visionService.restoreLog({
              id: logId,
              user_id: log.user_id,
              grams: log.grams ?? null,
              metabolic_tags_json: log.metabolic_tags_json,
              captured_at: log.captured_at,
              local_date: log.local_date ?? null,
            });
          } catch {
            // Row may already exist if the original delete failed; verify by
            // refetching rather than guessing
            queryClient.invalidateQueries({ predicate: (q) => isLogQuery(q.queryKey) });
          }
        },
      },
    });
  };

  return { updateLog, deleteLogWithUndo };
}
