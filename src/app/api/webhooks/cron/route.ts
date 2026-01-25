import { NextRequest, NextResponse } from 'next/server';
import { runEntropyCycle } from '@/lib/engine/pantry/entropy';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const task = searchParams.get('task');

  try {
    if (task === 'entropy') {
      const res = await runEntropyCycle();
      return NextResponse.json({ task: 'entropy', result: res });
    }
    
    // Future tasks:
    // if (task === 'weekly_digest') ...
    
    return NextResponse.json({ error: 'Unknown task' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
