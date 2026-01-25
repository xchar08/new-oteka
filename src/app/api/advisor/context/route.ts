import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateMetabolicAdvice } from '@/lib/workflows/advisor';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const context = (url.searchParams.get('context') as 'pre-log' | 'post-log') || 'pre-log';

  const cacheKey = `advisor:${user.id}:${context}`;
  const now = new Date();

  try {
    // 1. Check DB Cache
    const { data: cached } = await supabase
      .from('cache_entries')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > now) {
      return NextResponse.json(cached.value);
    }

    // 2. Generate Fresh Advice
    const result = await generateMetabolicAdvice(user.id, context);

    // 3. Save to Cache (1 hour)
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

    await supabase.from('cache_entries').upsert({
      key: cacheKey,
      value: result,
      expires_at: expiresAt,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Advisor Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
