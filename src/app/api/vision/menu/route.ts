import { NextRequest, NextResponse } from 'next/server';
import { parseMenuImage } from '@/lib/workflows/menu';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { data: userData } = await supabase.from('users').select('metabolic_state_json').eq('id', user.id).single();
  const goal = userData?.metabolic_state_json?.current_goal || 'maintenance';

  try {
    const result = await parseMenuImage(body.image, goal);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
