import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const supabase = createClient(
      Deno.env.get('PUBLIC_SUPABASE_URL') ?? '',
      Deno.env.get('PUBLIC_SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response('Unauthorized', { status: 401 });

    const body = await req.json();
    const queueItem = body.queue_item as {
      id: string;
      type: 'VISION_LOG' | 'PANTRY_VERIFY' | 'GENERIC_MUTATION';
      user_id: string;
      client_updated_at_ms: number;
    };

    if (queueItem.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    function shouldApplyClientMutation(params: {
      server_updated_at_ms: number | null;
      client_updated_at_ms: number;
    }) {
      if (params.server_updated_at_ms == null) return true;
      return params.client_updated_at_ms >= params.server_updated_at_ms;
    }

    if (queueItem.type === 'PANTRY_VERIFY') {
      const payload = body.payload as {
        pantry_id: number;
        status: 'active' | 'consumed';
        client_updated_at_ms: number;
      };

      const { data: current, error: curErr } = await supabase
        .from('pantry')
        .select('id, last_verified_at')
        .eq('id', payload.pantry_id)
        .single();

      if (curErr || !current) {
        return new Response(JSON.stringify({ error: 'pantry_not_found' }), { status: 404 });
      }

      const serverMs = current.last_verified_at
        ? new Date(current.last_verified_at as string).getTime()
        : null;

      const ok = shouldApplyClientMutation({
        server_updated_at_ms: serverMs,
        client_updated_at_ms:
          payload.client_updated_at_ms ?? queueItem.client_updated_at_ms,
      });

      if (!ok) {
        return new Response(
          JSON.stringify({ error: 'conflict_server_newer', server_ts: serverMs }),
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
        return new Response(JSON.stringify({ error: updErr.message }), { status: 500 });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (queueItem.type === 'VISION_LOG') {
      return new Response(
        JSON.stringify({ success: true, note: 'VISION_LOG accepted' }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: 'unknown_mutation_type' }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error('sync-apply error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
