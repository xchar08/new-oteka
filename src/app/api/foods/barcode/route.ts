import { NextRequest, NextResponse } from 'next/server';
import { fetchProductByBarcode } from '@/lib/vision/scanner';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const product = await fetchProductByBarcode(code);
  
  if (!product) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(product);
}
