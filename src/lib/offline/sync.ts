import { listQueue, markQueueItem, readQueuePayload, deleteQueueItem, type QueueItem } from './queue';

export async function processOfflineQueue() {
  if (!navigator.onLine) return;

  const items = await listQueue();
  const pending = items.filter((i) => i.status === 'PENDING' || i.status === 'FAILED');

  for (const item of pending) {
    try {
      const payload = await readQueuePayload(item);

      const res = await fetch('/api/sync/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queue_item: {
            id: item.id,
            type: item.type,
            user_id: item.user_id,
            client_updated_at_ms: item.client_updated_at_ms,
          },
          payload,
        }),
      });

      if (res.ok) {
        await deleteQueueItem(item.id);
        continue;
      }

      if (res.status === 409) {
        // Server is newer; drop the mutation (or surface UI later)
        await deleteQueueItem(item.id);
        continue;
      }

      const text = await res.text().catch(() => '');
      await markQueueItem(item, { status: 'FAILED', last_error: `HTTP ${res.status} ${text}` });
    } catch (e: any) {
      await markQueueItem(item, { status: 'FAILED', last_error: e?.message ?? 'sync_failed' });
    }
  }
}

export function installQueueAutoSync() {
  const handler = () => processOfflineQueue();

  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
