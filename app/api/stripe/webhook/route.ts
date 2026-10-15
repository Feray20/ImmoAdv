import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Stripe-Webhook. Signatur wird mit dem Endpunkt-Secret (STRIPE_WEBHOOK_SECRET) geprüft.
// Freischaltungen werden live aus Stripe gelesen; der Webhook bestätigt Ereignisse und protokolliert sie.
// Doppelte Zustellungen sind unschädlich, weil hier kein Zustand verändert wird.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');
  if (!secret || !signature) return NextResponse.json({ error: 'not configured' }, { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const s = event.data.object as Stripe.Checkout.Session;
      console.info('billing_paid', { session: s.id, plan: s.metadata?.plan, status: s.payment_status });
      break;
    }
    case 'checkout.session.async_payment_failed':
    case 'invoice.payment_failed':
      console.warn('billing_payment_failed', { event: event.id, type: event.type });
      break;
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated':
      console.info('billing_subscription', { event: event.id, type: event.type });
      break;
    default:
      break;
  }
  return NextResponse.json({ received: true });
}
