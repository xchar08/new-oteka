import { createClient } from '@/lib/supabase/server.server';

export async function logWorkflowEvent(
  userId: string,
  triggerEvent: string,
  status: 'success' | 'pending' | 'failed',
  payload: Record<string, unknown> = {}
) {
  const supabase = await createClient();

  const { error } = await supabase.from('workflows').insert({
    user_id: userId,
    trigger_event: triggerEvent,
    last_run_status: status,
    logs_json: payload,
  });

  if (error) {
    // Never throw from audit; it must not break core flows
    console.error('logWorkflowEvent failed:', error.message);
  }
}
