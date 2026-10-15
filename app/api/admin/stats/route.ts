import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/billing/auth';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { billingEnabled } from '@/lib/billing/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isAdmin = (email: string) => (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());

// Betreiber-Übersicht: nur Zählwerte, keine personenbezogenen Inhalte.
export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 });
  if (!adminConfigured()) return NextResponse.json({ error: 'Nicht konfiguriert.' }, { status: 503 });
  const db = supabaseAdmin();
  const since = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
  const count = async (table: string, f?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = db.from(table).select('*', { count: 'exact', head: true });
    if (f) q = f(q);
    const { count: c, error } = await q;
    return error ? null : c ?? 0;
  };
  const [users, users7, docs, shares, sharesActive, versions, reminders, requestsOpen, partners] = await Promise.all([
    count('immo_user_data'),
    count('immo_user_data', (q) => q.gte('created_at', since(7))),
    count('immo_documents'),
    count('immo_data_room_shares'),
    count('immo_data_room_shares', (q) => q.is('revoked_at', null).gt('expires_at', new Date().toISOString())),
    count('immo_kreditmappe_versions'),
    count('immo_user_data', (q) => q.eq('profile->>reminders', 'true')),
    count('immo_document_requests', (q) => q.eq('status', 'offen')),
    count('immo_partners', (q) => q.eq('active', true)),
  ]);
  // Objekte: Summe der Objektlisten (nur Anzahl)
  const { data: od } = await db.from('immo_user_data').select('objects').limit(5000);
  const objects = (od ?? []).reduce((s, r) => s + (Array.isArray(r.objects) ? r.objects.length : 0), 0);
  return NextResponse.json({ users, users7, objects, docs, shares, sharesActive, versions, reminders, requestsOpen, partners,
    config: { billing: billingEnabled(), mail: Boolean(process.env.RESEND_API_KEY && (process.env.NOTIFY_FROM_EMAIL || process.env.CANCEL_FROM_EMAIL)), cron: Boolean(process.env.CRON_SECRET) } },
    { headers: { 'Cache-Control': 'no-store' } });
}
