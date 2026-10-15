import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/security/admin';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { adminAudit } from '@/lib/b2b/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const j = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// B2B-Anfragen (Demo, Enterprise, Kooperation), Partnercodes und Admin-Protokoll.
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!adminConfigured()) return j({ error: 'Nicht konfiguriert.' }, 503);
  const db = supabaseAdmin();
  const [{ data: contacts }, { data: codes }, { data: audit }] = await Promise.all([
    db.from('immo_b2b_contact').select('id, kind, name, company, email, phone, message, status, created_at').order('created_at', { ascending: false }).limit(300),
    db.from('immo_b2b_partner_codes').select('*').order('created_at', { ascending: false }).limit(300),
    db.from('immo_admin_audit').select('actor_email, action, target, meta, created_at').order('created_at', { ascending: false }).limit(200),
  ]);
  return j({ contacts: contacts ?? [], codes: codes ?? [], audit: audit ?? [] });
}

const Act = z.discriminatedUnion('action', [
  z.object({ action: z.literal('contactDone'), id: z.string().uuid() }),
  z.object({ action: z.literal('codeCreate'), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,30}$/), description: z.string().trim().max(200).optional(), maxRedemptions: z.number().int().min(1).max(100000).nullable().optional() }),
  z.object({ action: z.literal('codeActive'), code: z.string(), on: z.boolean() }),
]);

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const p = Act.safeParse(await req.json().catch(() => null));
  if (!p.success) return j({ error: 'Ungültige Aktion.' }, 400);
  const a = p.data;
  const db = supabaseAdmin();
  let r;
  if (a.action === 'contactDone') r = await db.from('immo_b2b_contact').update({ status: 'erledigt' }).eq('id', a.id);
  else if (a.action === 'codeCreate') r = await db.from('immo_b2b_partner_codes').insert({ code: a.code, description: a.description || null, max_redemptions: a.maxRedemptions ?? null });
  else r = await db.from('immo_b2b_partner_codes').update({ active: a.on }).eq('code', a.code);
  if (r.error) return j({ error: /duplicate/.test(r.error.message) ? 'Code existiert bereits.' : r.error.message }, 400);
  await adminAudit(auth.user.email, a.action, 'code' in a ? a.code : 'id' in a ? a.id : null);
  return j({ ok: true });
}
