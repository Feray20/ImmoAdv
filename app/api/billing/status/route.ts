import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/billing/auth';
import { billingEnabled, entitlementsFor } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';

// Freischaltungen des angemeldeten Nutzers. Wird auch direkt nach der Rückkehr aus dem Checkout aufgerufen.
export async function GET(req: Request) {
  const free = { enabled: false, pro: false, proSource: null, proUntil: null, creditMaps: 0, hasCustomer: false };
  if (!billingEnabled()) return NextResponse.json(free, { headers: { 'Cache-Control': 'no-store' } });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte zuerst anmelden.' }, { status: 401 });
  try {
    const e = await entitlementsFor(user.id, user.email);
    return NextResponse.json({ enabled: true, ...e }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('status_error', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Status konnte nicht geladen werden.' }, { status: 502 });
  }
}
