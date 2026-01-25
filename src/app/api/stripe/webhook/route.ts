import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // 1. Verify Signature
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  try {
    const body = await req.text();
    // const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

    // 2. Handle Events
    // switch (event.type) {
    //   case 'checkout.session.completed':
    //     await grantPremiumAccess(event.data.object.client_reference_id);
    //     break;
    // }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }
}
