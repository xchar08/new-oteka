import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  
  // Check Database Connection
  const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
  
  const status = error ? 'degraded' : 'healthy';
  
  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: error ? 'disconnected' : 'connected'
  }, { status: error ? 503 : 200 });
}
