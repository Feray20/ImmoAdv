import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/billing/auth';
import { billingEnabled, entitlementsFor } from '@/lib/billing/stripe';
import { isAdminEmail } from '@/lib/security/admin';
import { adminConfigured } from '@/lib/supabase/admin';
import { effectiveTier, membershipFor } from '@/lib/b2b/core';
import { allowRequest } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const j = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });

// Zugang für die Navigation: „Zur Anwendung" und App-Leiste nur für zahlende Kunden
// (gebuchter Tarif, aktives Unternehmenskonto) und Administratoren. Liefert nur Ja/Nein-Werte.
export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return j({ loggedIn: false, paid: false }, 401);
  if (!allowRequest(`me-access:${user.id}`, 30, 60_000)) return j({ error: 'Zu viele Anfragen.' }, 429);
  const admin = isAdminEmail(user.email);
  let tier = 'free';
  let b2b = false;
  if (billingEnabled()) {
    try { tier = (await entitlementsFor(user.id, user.email)).tier || 'free'; } catch { tier = 'free'; }
  }
  if (adminConfigured()) {
    try { const m = await membershipFor(user.id); b2b = Boolean(m && effectiveTier(m.account)); } catch { b2b = false; }
  }
  return j({ loggedIn: true, paid: admin || b2b || tier !== 'free', admin, b2b, tier });
}
