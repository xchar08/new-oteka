import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper defined locally to avoid importing client-side 'offline/sync' code in server route
function shouldApplyClientMutation(params: {
  server_updated_at_ms: number | null;
  client_updated_at_ms: number;
}) {
  if (params.server_updated_at_ms == null) return true;
  // If client timestamp is equal or newer, we accept it
  return params.client_updated_at_ms >= params.server_updated_at_ms;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const queueItem = body.queue_item as {
    id: string;
    type: 'VISION_LOG' | 'PANTRY_VERIFY' | 'GENERIC_MUTATION';
    user_id: string;
    client_updated_at_ms: number;
  };

  // Ensure user can only sync their own mutations
  if (queueItem.user_id !== auth.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Handle known mutation types
  if (queueItem.type === 'PANTRY_VERIFY') {
    const payload = body.payload as {
      pantry_id: number;
      status: 'active' | 'consumed';
      client_updated_at_ms: number;
    };

    // 1. Fetch current server state for conflict resolution
    // Note: Schema uses 'last_verified_at', not 'updated_at'
    const { data: current, error: curErr } = await supabase
      .from('pantry')
      .select('id, last_verified_at')
      .eq('id', payload.pantry_id)
      .single();

    if (curErr) {
      return NextResponse.json({ error: 'pantry_not_found' }, { status: 404 });
    }

    const serverMs = current?.last_verified_at
      ? new Date(current.last_verified_at).getTime()
      : null;

    const ok = shouldApplyClientMutation({
      server_updated_at_ms: serverMs,
      client_updated_at_ms:
        payload.client_updated_at_ms ?? queueItem.client_updated_at_ms,
    });

    if (!ok) {
      return NextResponse.json(
        { error: 'conflict_server_newer', server_ts: serverMs },
        { status: 409 }
      );
    }

    const { error: updErr } = await supabase
      .from('pantry')
      .update({
        status: payload.status,
        last_verified_at: new Date().toISOString(),
      })
      .eq('id', payload.pantry_id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (queueItem.type === 'VISION_LOG') {
    // Skeleton: real implementation would create a logs record
    return NextResponse.json({ success: true, note: 'VISION_LOG accepted' });
  }

  return NextResponse.json({ error: 'unknown_mutation_type' }, { status: 400 });
}
