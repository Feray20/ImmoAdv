import { NextResponse } from 'next/server';
import { createDecipheriv } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { OUTREACH_IMPORT } from '@/lib/outreach/import-data';
import { z } from 'zod';
import { requireAdmin } from '@/lib/security/admin';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { adminAudit } from '@/lib/b2b/core';
import { isSuppressed } from '@/lib/marketing/suppression';
import { fillTemplate, OUTREACH_IMAGES, sendOutreach, wrapDocument } from '@/lib/outreach/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Web-Admin → Akquise → E-Mails: persönliche Presse- und Kooperationsanfragen ansehen, anpassen und einzeln senden.
// Abmeldungen kommen über /api/abmelden zurück (Sperrliste + Akquise-Status „Widerspruch“).
const j = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const BOOKING = 'outreach_booking_url';
const IMPORT = 'outreach_import';
const unsubUrl = (t: string | null) => (t ? `https://immoadv.de/api/abmelden?t=${t}` : null);

// Einmaliger Import: verschlüsselte Entwürfe aus dem Code, Schlüssel in immo_settings (wird danach gelöscht).
async function runImport(email: string) {
  const db = supabaseAdmin();
  const { data } = await db.from('immo_settings').select('value').eq('key', IMPORT).maybeSingle();
  if (!data?.value || typeof data.value !== 'string' || !OUTREACH_IMPORT) return 0;
  const buf = Buffer.from(OUTREACH_IMPORT, 'base64');
  const dc = createDecipheriv('aes-256-gcm', Buffer.from(data.value, 'base64'), buf.subarray(0, 12));
  dc.setAuthTag(buf.subarray(12, 28));
  const plain = Buffer.concat([dc.update(buf.subarray(28)), dc.final()]);
  const rows = JSON.parse(inflateSync(plain).toString('utf8')) as { to: string; subject: string; html: string; text: string; fallback: string | null; token: string | null }[];
  const { data: have } = await db.from('immo_outreach_mails').select('to_email, subject');
  const seen = new Set((have ?? []).map((r) => `${r.to_email}\n${r.subject}`));
  const fresh = rows.filter((r) => !seen.has(`${r.to}\n${r.subject}`));
  if (fresh.length) {
    const ins = await db.from('immo_outreach_mails').insert(fresh.map((r) => ({ to_email: r.to, subject: r.subject, html: r.html, text_body: r.text, termin_fallback: r.fallback, token: r.token, source: 'gmail-entwurf' })));
    if (ins.error) throw new Error(ins.error.message);
  }
  await db.from('immo_settings').delete().eq('key', IMPORT);
  await adminAudit(email, 'outreach_import', null, { n: fresh.length });
  return fresh.length;
}

async function bookingUrl(): Promise<string | null> {
  const { data } = await supabaseAdmin().from('immo_settings').select('value').eq('key', BOOKING).maybeSingle();
  return typeof data?.value === 'string' && /^https:\/\//.test(data.value) ? data.value : null;
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!adminConfigured()) return j({ error: 'Nicht konfiguriert.' }, 503);
  const db = supabaseAdmin();
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return j({ error: 'Ungültig.' }, 400);
    const { data: m } = await db.from('immo_outreach_mails').select('*').eq('id', id).maybeSingle();
    if (!m) return j({ error: 'Nicht gefunden.' }, 404);
    // Vorschau: eingebettete Bilder über die öffentlichen Adressen anzeigen.
    let html = fillTemplate(m.html, await bookingUrl(), m.termin_fallback);
    for (const a of OUTREACH_IMAGES) html = html.split(`cid:${a.content_id}`).join(a.path);
    return j({ mail: { ...m, preview: wrapDocument(m.subject, html, m.text_body) } });
  }
  let imported = 0;
  try { imported = await runImport(auth.user.email); } catch (e) { console.error('outreach_import', (e as Error).message); }
  const [{ data: rows, error }, { data: links }] = await Promise.all([
    db.from('immo_outreach_mails').select('id, to_email, subject, status, error, sent_at, created_at, token').order('created_at', { ascending: true }).limit(1000),
    db.from('immo_outreach_links').select('token, opted_out_at').not('opted_out_at', 'is', null),
  ]);
  if (error) return j({ error: 'Nicht verfügbar.' }, 502);
  const out = new Set((links ?? []).map((l) => l.token));
  return j({ imported, booking: await bookingUrl(), mails: (rows ?? []).map((r) => ({ ...r, optedOut: Boolean(r.token && out.has(r.token)), token: undefined })) });
}

const Act = z.discriminatedUnion('action', [
  z.object({ action: z.literal('send'), id: z.string().uuid() }),
  z.object({ action: z.literal('update'), id: z.string().uuid(), subject: z.string().trim().min(2).max(180).optional(), to: z.string().trim().toLowerCase().email().max(200).optional() }),
  z.object({ action: z.literal('booking'), url: z.union([z.literal(''), z.string().trim().url().max(500).regex(/^https:\/\//)]) }),
  z.object({ action: z.literal('delete'), id: z.string().uuid() }),
]);

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!adminConfigured()) return j({ error: 'Nicht konfiguriert.' }, 503);
  const p = Act.safeParse(await req.json().catch(() => null));
  if (!p.success) return j({ error: 'Bitte die Angaben prüfen.' }, 400);
  const a = p.data, db = supabaseAdmin(), actor = auth.user.email;
  if (a.action === 'booking') {
    const r = a.url ? await db.from('immo_settings').upsert({ key: BOOKING, value: a.url, updated_at: new Date().toISOString(), updated_by: actor }) : await db.from('immo_settings').delete().eq('key', BOOKING);
    if (r.error) return j({ error: 'Speichern fehlgeschlagen.' }, 500);
    await adminAudit(actor, 'outreach_booking', null, { set: Boolean(a.url) });
    return j({ ok: true });
  }
  const { data: m } = await db.from('immo_outreach_mails').select('*').eq('id', a.id).maybeSingle();
  if (!m) return j({ error: 'Nicht gefunden.' }, 404);
  if (a.action === 'delete') {
    await db.from('immo_outreach_mails').delete().eq('id', a.id);
    await adminAudit(actor, 'outreach_delete', m.to_email);
    return j({ ok: true });
  }
  if (a.action === 'update') {
    if (m.status === 'gesendet') return j({ error: 'Bereits gesendet.' }, 409);
    const up: Record<string, unknown> = {};
    if (a.subject) up.subject = a.subject;
    if (a.to && a.to !== m.to_email) {
      up.to_email = a.to;
      // Neuer Empfänger: eigener Abmeldelink.
      const { randomBytes } = await import('node:crypto');
      const t = randomBytes(18).toString('base64url');
      await db.from('immo_outreach_links').insert({ token: t, email: a.to, label: (a.subject || m.subject).slice(0, 160) });
      if (m.token) { up.html = String(m.html).split(m.token).join(t); up.text_body = String(m.text_body).split(m.token).join(t); }
      up.token = t;
    }
    const r = await db.from('immo_outreach_mails').update(up).eq('id', a.id);
    return r.error ? j({ error: 'Speichern fehlgeschlagen.' }, 500) : j({ ok: true });
  }
  // Senden
  if (m.status === 'gesendet') return j({ error: 'Diese E-Mail wurde bereits gesendet.' }, 409);
  const [blocked] = await isSuppressed([{ email: m.to_email }]).catch(() => [false]);
  if (blocked) { await db.from('immo_outreach_mails').update({ status: 'gesperrt', error: 'Empfänger hat widersprochen (Sperrliste).' }).eq('id', a.id); return j({ error: 'Empfänger steht auf der Sperrliste (Abmeldung/Widerspruch) – nicht gesendet.' }, 409); }
  const html = wrapDocument(m.subject, fillTemplate(m.html, await bookingUrl(), m.termin_fallback), m.text_body);
  const res = await sendOutreach({ to: m.to_email, subject: m.subject, html, text: m.text_body, unsubUrl: unsubUrl(m.token) });
  const now = new Date().toISOString();
  if (!res.ok) {
    await db.from('immo_outreach_mails').update({ status: 'fehler', error: res.error.slice(0, 300) }).eq('id', a.id);
    return j({ error: res.error }, 502);
  }
  await db.from('immo_outreach_mails').update({ status: 'gesendet', error: null, sent_at: now, sent_by: actor }).eq('id', a.id);
  // Akquise: Kontakt anlegen bzw. fortschreiben, Verlauf „E-Mail“.
  const { data: cs } = await db.from('immo_crm_contacts').select('id, status').ilike('email', m.to_email);
  let ids = (cs ?? []).map((c) => c.id as string);
  if (!ids.length) {
    const domain = m.to_email.split('@')[1] || m.to_email;
    const ins = await db.from('immo_crm_contacts').insert({ kind: 'sonstige', company: domain.slice(0, 160), email: m.to_email, status: 'angeschrieben', source: 'Presse-/Kooperationsanfrage per E-Mail' }).select('id').single();
    if (ins.data) ids = [ins.data.id as string];
  } else {
    await db.from('immo_crm_contacts').update({ status: 'angeschrieben', updated_at: now }).in('id', ids).eq('status', 'neu');
  }
  if (ids.length) await db.from('immo_crm_activities').insert(ids.map((cid) => ({ contact_id: cid, type: 'email', note: `Gesendet: ${m.subject}`.slice(0, 1000), campaign: 'presse', actor })));
  await adminAudit(actor, 'outreach_send', m.to_email, { id: a.id });
  return j({ ok: true, id: res.id });
}
