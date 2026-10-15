import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/billing/auth';
import { billingEnabled, findCustomer, stripe } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';

// Stripe-Kundenportal: Rechnungen herunterladen, Zahlungsmittel ändern, Abo kündigen.
export async function POST(req: Request) {
  if (!billingEnabled()) return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte zuerst anmelden.' }, { status: 401 });
  try {
    const customer = await findCustomer(user.id, user.email);
    if (!customer) return NextResponse.json({ error: 'Noch keine Käufe vorhanden.' }, { status: 404 });
    const session = await stripe().billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${new URL(req.url).origin}/app/dashboard`,
      locale: 'de',
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('portal_error', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Kundenportal konnte nicht geöffnet werden.' }, { status: 502 });
  }
}
