import {
  listQueue,
  markQueueItem,
  readQueuePayload,
  deleteQueueItem,
  type QueueItem,
} from './queue';
import { createClient } from '@/lib/supabase/client';

export async function processOfflineQueue() {
  if (!navigator.onLine) return;

  const items = await listQueue();
  const pending = items.filter(
    (i) => i.status === 'PENDING' || i.status === 'FAILED'
  );

  if (pending.length === 0) return;

  const supabase = createClient();

  for (const item of pending) {
    try {
      const payload = await readQueuePayload(item);

      const { data, error } = await supabase.functions.invoke('sync-apply', {
        body: {
          queue_item: {
            id: item.id,
            type: item.type,
            user_id: item.user_id,
            client_updated_at_ms: item.client_updated_at_ms,
          },
          payload,
        },
      });

      if (!error) {
        await deleteQueueItem(item.id);
        continue;
      }

      // Optional: handle conflict hint from Edge Function
      if ((data as any)?.error === 'conflict_server_newer') {
        await deleteQueueItem(item.id);
        continue;
      }

      await markQueueItem(item, {
        status: 'FAILED',
        last_error: error.message ?? 'sync_failed',
      });
    } catch (e: any) {
      await markQueueItem(item, {
        status: 'FAILED',
        last_error: e?.message ?? 'sync_failed',
      });
    }
  }
}

export function installQueueAutoSync() {
  const handler = () => processOfflineQueue();
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
