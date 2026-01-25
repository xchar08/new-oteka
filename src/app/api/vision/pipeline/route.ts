import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runVisionPipeline } from '@/lib/workflows/vision';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();

  if (authErr || !auth?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const image = body?.image as string | undefined;

  if (!image) {
    return NextResponse.json({ error: 'Missing image' }, { status: 400 });
  }

  try {
    const result = await runVisionPipeline(auth.user.id, image);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Vision failed' }, { status: 500 });
  }
}
