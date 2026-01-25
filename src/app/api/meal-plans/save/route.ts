import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { items, total_calories } = body;

  const { error } = await supabase.from('logs').insert({
    user_id: user.id,
    grams: 0,
    metabolic_tags_json: { 
      type: 'plan', 
      items: items, 
      planned_calories: total_calories 
    }
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
