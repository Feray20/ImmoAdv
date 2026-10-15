import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { adminAudit, effectiveTier, type B2BAccount } from '@/lib/b2b/core';
import { setPanic } from '@/lib/security/panic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const j = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// Lesende Portal-Ansicht für den Support – nur solange das Unternehmen den Support-Zugriff freigegeben hat.
// Jeder Abruf wird protokolliert. Kein Einloggen als Partner, keine Änderungen.
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!adminConfigured()) return j({ error: 'Nicht konfiguriert.' }, 503);
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(id)) return j({ error: 'Ungültig.' }, 400);
  const db = supabaseAdmin();
  const { data } = await db.from('immo_b2b_accounts').select('*').eq('id', id).maybeSingle();
  const a = data as B2BAccount | null;
  if (!a) return j({ error: 'Nicht gefunden.' }, 404);
  if (!a.support_access_until || new Date(a.support_access_until).getTime() < Date.now()) {
    return j({ error: 'Das Unternehmen hat keinen Support-Zugriff freigegeben (Portal → Profil → Support-Zugriff).' }, 403);
  }
  const { data: leads } = await db
    .from('immo_b2b_leads')
    .select('id, source, client_name, client_email, client_phone, message, property_data, metrics, status, assigned_to, created_at')
    .eq('account_id', id)
    .order('created_at', { ascending: false })
    .limit(200);
  await adminAudit(auth.user.email, 'support_view', id, { leads: leads?.length ?? 0, until: a.support_access_until });
  return j({ account: { company: a.company_name, tier: effectiveTier(a), slug: a.slug, widgetActive: a.widget_active, allowedDomains: a.allowed_domains, until: a.support_access_until }, leads: leads ?? [] });
}

// Not-Aus ein/aus.
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const b = (await req.json().catch(() => null)) as { panic?: unknown; reason?: unknown } | null;
  if (typeof b?.panic !== 'boolean') return j({ error: 'Ungültig.' }, 400);
  const reason = typeof b.reason === 'string' ? b.reason.slice(0, 300) : '';
  await setPanic(b.panic, auth.user.email, reason);
  await adminAudit(auth.user.email, b.panic ? 'panic_on' : 'panic_off', null, { reason });
  return j({ ok: true });
}
