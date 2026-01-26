'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ReviewNeededCard } from '@/components/pantry/ReviewNeededCard';
import { enqueueMutation } from '@/lib/offline/queue';
import { processOfflineQueue } from '@/lib/offline/sync';
import { useAppStore } from '@/lib/state/appStore';
import { useConnectionMode } from '@/lib/hooks/useConnectionMode';

type PantryRow = {
  id: number;
  probability_score: number;
  status: 'active' | 'review_needed' | 'consumed';
  foods: { name: string } | null;
};

export default function PantryPage() {
  useConnectionMode();

  const supabase = createClient();
  
  // ✅ FIX: Select primitive value to prevent infinite re-renders
  const isOnline = useAppStore((s) => s.isOnline);
  const setLastSyncAt = useAppStore((s) => s.setLastSyncAt);

  const [rows, setRows] = useState<PantryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reviewNeeded = useMemo(
    () => rows.filter((r) => r.status === 'review_needed'),
    [rows]
  );

  const active = useMemo(
    () => rows.filter((r) => r.status === 'active'),
    [rows]
  );

  // ✅ FIX: Wrap in useCallback to stabilize the function reference
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pantry')
      .select('id, probability_score, status, foods(name)')
      .in('status', ['active', 'review_needed'])
      .order('status', { ascending: false });

    if (!error && data) setRows(data as any);
    setLoading(false);
  }, [supabase]);

  // Initial Load
  useEffect(() => {
    load();
  }, [load]);

  // Sync Listener
  useEffect(() => {
    // Opportunistic sync when coming online
    if (isOnline) {
      (async () => {
        await processOfflineQueue();
        setLastSyncAt(new Date().toISOString());
        await load();
      })();
    }
  }, [isOnline, setLastSyncAt, load]);

  async function verify(pantryId: number, status: 'active' | 'consumed') {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      alert('Please log in first');
      return;
    }

    const payload = {
      pantry_id: pantryId,
      status,
      client_updated_at_ms: Date.now(),
    };

    // Optimistic UI update immediately
    setRows((prev) =>
      prev.map((r) => (r.id === pantryId ? { ...r, status } : r))
    );

    if (!isOnline) {
      await enqueueMutation({
        id: crypto.randomUUID(),
        type: 'PANTRY_VERIFY',
        user_id: userId,
        payload,
        client_updated_at_ms: payload.client_updated_at_ms,
      });
      return;
    }

    // Online: Try Edge Function first
    try {
      const { error } = await supabase.functions.invoke('sync-apply', {
        body: {
          queue_item: {
            id: crypto.randomUUID(),
            type: 'PANTRY_VERIFY',
            user_id: userId,
            client_updated_at_ms: payload.client_updated_at_ms,
          },
          payload,
        },
      });

      if (error) {
        throw new Error(error.message || 'Sync failed');
      }

      // Reload to ensure state matches server
      await load();
    } catch (e) {
      console.warn('Direct sync failed, queuing mutation', e);
      await enqueueMutation({
        id: crypto.randomUUID(),
        type: 'PANTRY_VERIFY',
        user_id: userId,
        payload,
        client_updated_at_ms: payload.client_updated_at_ms,
      });
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 flex justify-center items-center h-[50vh]">
        <div className="animate-pulse">Loading pantry...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-24">
      <h1 className="text-2xl font-bold">Pantry Inventory</h1>

      {reviewNeeded.length > 0 && (
        <section className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
            <h2 className="text-lg font-semibold text-orange-800 mb-2">
              Verify Spoilage
            </h2>
            <p className="text-sm text-orange-600 mb-4">
              These {reviewNeeded.length} items have a low probability score
              based on decay rates.
            </p>

            <div className="space-y-3">
              {reviewNeeded.map((r) => (
                <ReviewNeededCard
                  key={r.id}
                  id={r.id}
                  name={r.foods?.name ?? 'Unknown Item'}
                  probability={Number(r.probability_score)}
                  onConfirmGood={() => verify(r.id, 'active')}
                  onConfirmSpoiled={() => verify(r.id, 'consumed')}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-800">Active Items</h2>
        {active.length === 0 && (
          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            Pantry is empty.
          </div>
        )}

        <div className="space-y-2">
          {active.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm flex justify-between items-center"
            >
              <div>
                <div className="font-medium text-gray-900">
                  {r.foods?.name ?? 'Unknown'}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      r.probability_score > 0.7
                        ? 'bg-green-500'
                        : 'bg-yellow-500'
                    }`}
                  />
                  Health:{' '}
                  {Math.round(Number(r.probability_score) * 100)}%
                </div>
              </div>
              <button
                className="text-sm px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                onClick={() => verify(r.id, 'consumed')}
              >
                Use / Trash
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
