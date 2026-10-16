import { z } from 'zod';
import { allowRequest } from '@/lib/security/rate-limit';
import { adminConfigured, anonymizedIpHash, supabaseAdmin } from '@/lib/supabase/admin';
import { json } from '@/lib/b2b/http';
import { adminList } from '@/lib/security/admin';
import { mailConfigured, sendMail } from '@/lib/notify/mail';
import { guardSubmission } from '@/lib/security/antispam';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Schema = z.object({
  kind: z.enum(['demo', 'enterprise', 'kooperation']),
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().max(2000).optional().default(''),
  privacy: z.literal(true),
  website: z.string().optional().default(''),
  ts: z.coerce.number().optional(),
});

// Anfrage für Demo, Enterprise-Angebot oder Kooperation (Banken, Kanzleien).
export async function POST(req: Request) {
  if (!adminConfigured()) return json({ error: 'Nicht verfügbar.' }, 503);
  const ip = anonymizedIpHash(req) ?? 'x';
  if (!allowRequest(`b2b-contact:${ip}`, 3, 10 * 60_000)) return json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }, 429);
  const p = Schema.safeParse(await req.json().catch(() => null));
  if (!p.success) {
    const f = String(p.error.issues[0]?.path[0] ?? '');
    return json({ error: f === 'privacy' ? 'Bitte die Datenschutzhinweise bestätigen.' : 'Bitte die Angaben prüfen.' }, 400);
  }
  const b = p.data;
  const guard = await guardSubmission({ email: b.email, name: b.name, message: b.message, website: b.website, ts: b.ts, bucket: 'b2b-contact' });
  if (guard.action === 'drop') return json({ ok: true }, 201);
  if (guard.action === 'reject') return json({ error: guard.error, field: guard.field, suggestion: guard.suggestion }, 400);
  const flag = guard.action === 'allow' && guard.flagged ? ' [Spam-Verdacht]' : '';
  const ins = await supabaseAdmin().from('immo_b2b_contact').insert({ kind: b.kind, name: b.name, company: b.company, email: b.email, phone: b.phone || null, message: (b.message || '') + flag || null, ip_hash: ip });
  if (ins.error) return json({ error: 'Anfrage konnte nicht gespeichert werden.' }, 500);
  if (mailConfigured()) {
    for (const to of adminList()) await sendMail(to, `B2B-Anfrage (${b.kind}): ${b.company}`, `${b.name}, ${b.company}\n${b.email} · ${b.phone || '–'}\n\n${b.message || '–'}`);
  }
  return json({ ok: true }, 201);
}
