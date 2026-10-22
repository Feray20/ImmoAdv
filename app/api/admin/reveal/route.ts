import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/security/admin';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { adminAudit } from '@/lib/b2b/core';
import { adminScope } from '@/lib/admin/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const j = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store, private' } });

// „Aufdecken“: einzelnes maskiertes Feld im Klartext abrufen. Nur Administratoren mit 2FA (requireAdmin),
// jeder Abruf wird mit Feld, Zweck und Ziel revisionssicher in immo_admin_audit protokolliert.
const Body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user'), id: z.string().uuid(), field: z.literal('email'), purpose: z.enum(['ansicht', 'loeschen', 'kontakt']).default('ansicht') }),
  z.object({ kind: z.literal('b2b'), id: z.string().uuid(), field: z.enum(['email', 'tax_id', 'phone']), purpose: z.enum(['ansicht', 'loeschen', 'kontakt']).default('ansicht') }),
  z.object({ kind: z.literal('b2b_export'), purpose: z.literal('export').default('export') }),
]);

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!adminConfigured()) return j({ error: 'Nicht konfiguriert.' }, 503);
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return j({ error: 'Ungültig.' }, 400);
  const b = p.data;
  const sc = adminScope(req);
  if (sc === 'system') return j({ error: 'Im Bereich System werden keine Kundendaten angezeigt.' }, 403);
  const db = supabaseAdmin();
  if (b.kind === 'user') {
    const { data } = await db.auth.admin.getUserById(b.id);
    if (!data?.user) return j({ error: 'Nicht gefunden.' }, 404);
    await adminAudit(auth.user.email, 'pii_reveal', b.id, { kind: 'user', field: 'email', purpose: b.purpose });
    return j({ value: data.user.email || '' });
  }
  if (sc && sc !== 'b2b') return j({ error: 'Diese Daten gehören nicht zum gewählten Bereich.' }, 403);
  if (b.kind === 'b2b_export') {
    const { data, error } = await db.from('immo_b2b_accounts').select('id, email, tax_id').limit(1000);
    if (error) return j({ error: 'Nicht verfügbar.' }, 502);
    await adminAudit(auth.user.email, 'pii_reveal', null, { kind: 'b2b_export', rows: (data || []).length });
    return j({ rows: data || [] });
  }
  const { data: a } = await db.from('immo_b2b_accounts').select(b.field).eq('id', b.id).maybeSingle();
  if (!a) return j({ error: 'Nicht gefunden.' }, 404);
  await adminAudit(auth.user.email, 'pii_reveal', b.id, { kind: 'b2b', field: b.field, purpose: b.purpose });
  return j({ value: String((a as Record<string, unknown>)[b.field] ?? '') });
}
