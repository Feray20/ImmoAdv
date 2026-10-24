import { NextResponse } from 'next/server';
import { createDecipheriv, randomUUID } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { z } from 'zod';
import { requireAdmin } from '@/lib/security/admin';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { adminAudit } from '@/lib/b2b/core';
import { buildOutgoing, sendRow, type MailRow } from '@/lib/mail/compose';
import { mailboxAddress } from '@/lib/mail/resend';
import { normSubject, snippetOf } from '@/lib/mail/store';
import { htmlToText, sanitizeBody } from '@/lib/mail/template';
import { OUTREACH_IMPORT } from '@/lib/mail/import-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Web-Admin → Postfach: Posteingang, Gesendet, Entwürfe, Markiert, Archiv, Spam, Papierkorb – lesen, antworten, schreiben.
const j = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const FOLDERS = ['inbox', 'sent', 'drafts', 'archive', 'spam', 'trash'] as const;
const LIST_COLS = 'id, thread_id, direction, folder, status, design, from_email, from_name, to_emails, subject, snippet, starred, read_at, created_at, sent_at, received_at, attachments, error, contact_id';
const MAX_INLINE = 3 * 1024 * 1024;

// Einmaliger Import der vorbereiteten Presse-Entwürfe (verschlüsselt im Code, Schlüssel in immo_settings).
async function runImport(email: string): Promise<number> {
  const db = supabaseAdmin();
  const { data } = await db.from('immo_settings').select('value').eq('key', 'outreach_import').maybeSingle();
  if (!data?.value || typeof data.value !== 'string' || !OUTREACH_IMPORT) return 0;
  const buf = Buffer.from(OUTREACH_IMPORT, 'base64');
  const dc = createDecipheriv('aes-256-gcm', Buffer.from(data.value, 'base64'), buf.subarray(0, 12));
  dc.setAuthTag(buf.subarray(12, 28));
  const rows = JSON.parse(inflateSync(Buffer.concat([dc.update(buf.subarray(28)), dc.final()])).toString('utf8')) as { to: string; subject: string; html: string; text: string; fallback: string | null; token: string | null }[];
  const { data: have } = await db.from('immo_mail_messages').select('subject, to_emails').eq('source', 'gmail-entwurf');
  const seen = new Set((have ?? []).map((r) => `${(r.to_emails as string[])[0]}\n${r.subject}`));
  const fresh = rows.filter((r) => !seen.has(`${r.to}\n${r.subject}`));
  if (fresh.length) {
    const ins = await db.from('immo_mail_messages').insert(fresh.map((r) => {
      const id = randomUUID();
      return { id, thread_id: id, direction: 'out', folder: 'drafts', status: 'entwurf', design: 'fertig', from_email: mailboxAddress(), to_emails: [r.to], subject: r.subject, html: r.html, text_body: r.text, snippet: snippetOf(r.text), termin_fallback: r.fallback, token: r.token, source: 'gmail-entwurf' };
    }));
    if (ins.error) throw new Error(ins.error.message);
  }
  await db.from('immo_settings').delete().eq('key', 'outreach_import');
  await adminAudit(email, 'mail_import', null, { n: fresh.length });
  return fresh.length;
}

// Eingehendes HTML für die Anzeige: eingebettete Bilder (cid) als data-URL, damit sie im abgeschotteten Rahmen erscheinen.
async function inboundView(m: MailRow): Promise<string> {
  let html = m.html || `<pre style="white-space:pre-wrap;font:15px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:16px">${String(m.text_body || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)}</pre>`;
  let budget = MAX_INLINE;
  for (const a of m.attachments || []) {
    if (!a.cid || !html.includes(`cid:${a.cid}`) || a.size > budget) continue;
    const { data } = await supabaseAdmin().storage.from('mail').download(a.path);
    if (!data) continue;
    budget -= a.size;
    html = html.split(`cid:${a.cid}`).join(`data:${a.type};base64,${Buffer.from(await data.arrayBuffer()).toString('base64')}`);
  }
  const base = '<base target="_blank"><meta name="referrer" content="no-referrer"><style>body{margin:0;padding:12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;word-wrap:break-word}img{max-width:100%;height:auto}</style>';
  return /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${base}`) : `<!doctype html><html><head><meta charset="utf-8">${base}</head><body>${html}</body></html>`;
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!adminConfigured()) return j({ error: 'Nicht konfiguriert.' }, 503);
  const db = supabaseAdmin();
  const q = new URL(req.url).searchParams;
  const id = q.get('id');
  if (id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return j({ error: 'Ungültig.' }, 400);
    const { data: m } = await db.from('immo_mail_messages').select('*').eq('id', id).maybeSingle();
    if (!m) return j({ error: 'Nicht gefunden.' }, 404);
    const { data: thread } = await db.from('immo_mail_messages').select('*').eq('thread_id', m.thread_id).neq('folder', 'trash').order('created_at', { ascending: true }).limit(50);
    const list = (thread ?? []) as MailRow[];
    if (!list.find((x) => x.id === id)) list.push(m as MailRow);
    const out = [];
    for (const x of list) {
      const view = x.direction === 'in' ? await inboundView(x) : (await buildOutgoing(x, true)).html;
      out.push({ ...x, html: x.id === id && x.design === 'frei' && x.status !== 'gesendet' ? x.html : undefined, view });
    }
    const unread = list.filter((x) => x.direction === 'in' && !x.read_at).map((x) => x.id);
    if (unread.length) await db.from('immo_mail_messages').update({ read_at: new Date().toISOString() }).in('id', unread);
    let contact = null;
    if (m.contact_id) { const { data: c } = await db.from('immo_crm_contacts').select('id, company, contact_name, status').eq('id', m.contact_id).maybeSingle(); contact = c; }
    return j({ message: out.find((x) => x.id === id), thread: out, contact });
  }
  const file = q.get('file');
  if (file) {
    const [mid, idx] = file.split(':');
    if (!/^[0-9a-f-]{36}$/.test(mid || '')) return j({ error: 'Ungültig.' }, 400);
    const { data: m } = await db.from('immo_mail_messages').select('attachments').eq('id', mid).maybeSingle();
    const a = (m?.attachments as MailRow['attachments'] | undefined)?.[Number(idx)];
    if (!a) return j({ error: 'Nicht gefunden.' }, 404);
    const s = await db.storage.from('mail').createSignedUrl(a.path, 120, { download: a.name });
    return s.data ? j({ url: s.data.signedUrl }) : j({ error: 'Nicht verfügbar.' }, 502);
  }
  let imported = 0;
  try { imported = await runImport(auth.user.email); } catch (e) { console.error('mail_import', (e as Error).message); }
  const folder = q.get('folder') || 'inbox';
  const search = (q.get('q') || '').trim().slice(0, 100);
  let sel = db.from('immo_mail_messages').select(LIST_COLS).order('created_at', { ascending: false }).limit(300);
  if (folder === 'starred') sel = sel.eq('starred', true).neq('folder', 'trash');
  else if ((FOLDERS as readonly string[]).includes(folder)) sel = sel.eq('folder', folder);
  else return j({ error: 'Unbekannter Ordner.' }, 400);
  if (search) { const s = search.replace(/[%,()]/g, ' '); sel = sel.or(`subject.ilike.%${s}%,from_email.ilike.%${s}%,snippet.ilike.%${s}%,from_name.ilike.%${s}%`); }
  const [{ data: rows, error }, { data: counts }, { data: booking }] = await Promise.all([
    sel,
    db.from('immo_mail_messages').select('folder, read_at, direction, status').in('folder', ['inbox', 'drafts', 'spam']),
    db.from('immo_settings').select('value').eq('key', 'outreach_booking_url').maybeSingle(),
  ]);
  if (error) return j({ error: 'Nicht verfügbar.' }, 502);
  // Unterhaltungen: im Posteingang nur die neueste Nachricht je Verlauf.
  const seen = new Set<string>(), items = [];
  for (const r of rows ?? []) { if (folder !== 'drafts' && seen.has(r.thread_id as string)) continue; seen.add(r.thread_id as string); items.push(r); }
  const c = counts ?? [];
  return j({
    imported, mailbox: mailboxAddress(), booking: typeof booking?.value === 'string' ? booking.value : '',
    receiving: Boolean(process.env.RESEND_INBOUND_SECRET || process.env.RESEND_WEBHOOK_SECRET),
    counts: { inbox: c.filter((x) => x.folder === 'inbox' && x.direction === 'in' && !x.read_at).length, drafts: c.filter((x) => x.folder === 'drafts').length, spam: c.filter((x) => x.folder === 'spam' && !x.read_at).length },
    items,
  });
}

const Emails = z.array(z.string().trim().toLowerCase().email().max(200)).max(20);
const Act = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), id: z.string().uuid().optional(), to: Emails, cc: Emails.optional(), subject: z.string().max(300), body: z.string().max(400000).optional(), withUnsub: z.boolean().optional(), replyTo: z.string().uuid().optional(), forward: z.string().uuid().optional(), send: z.boolean().optional(), preview: z.boolean().optional() }),
  z.object({ action: z.literal('send'), id: z.string().uuid() }),
  z.object({ action: z.literal('mark'), ids: z.array(z.string().uuid()).min(1).max(200), read: z.boolean().optional(), starred: z.boolean().optional(), folder: z.enum(FOLDERS).optional() }),
  z.object({ action: z.literal('purge'), ids: z.array(z.string().uuid()).min(1).max(200) }),
  z.object({ action: z.literal('uploadUrl'), id: z.string().uuid(), name: z.string().trim().min(1).max(160), size: z.number().int().min(1).max(20 * 1024 * 1024) }),
  z.object({ action: z.literal('attach'), id: z.string().uuid(), path: z.string().max(400), name: z.string().max(160), type: z.string().max(120), size: z.number().int().min(1) }),
  z.object({ action: z.literal('detach'), id: z.string().uuid(), index: z.number().int().min(0).max(50) }),
  z.object({ action: z.literal('booking'), url: z.union([z.literal(''), z.string().trim().url().max(500).regex(/^https:\/\//)]) }),
]);

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!adminConfigured()) return j({ error: 'Nicht konfiguriert.' }, 503);
  const p = Act.safeParse(await req.json().catch(() => null));
  if (!p.success) return j({ error: p.error.issues[0]?.path.includes('to') ? 'Bitte gültige E-Mail-Adressen angeben.' : 'Bitte die Angaben prüfen.' }, 400);
  const a = p.data, db = supabaseAdmin(), actor = auth.user.email, now = new Date().toISOString();

  if (a.action === 'booking') {
    const r = a.url ? await db.from('immo_settings').upsert({ key: 'outreach_booking_url', value: a.url, updated_at: now, updated_by: actor }) : await db.from('immo_settings').delete().eq('key', 'outreach_booking_url');
    return r.error ? j({ error: 'Speichern fehlgeschlagen.' }, 500) : j({ ok: true });
  }
  if (a.action === 'mark') {
    const up: Record<string, unknown> = { updated_at: now };
    if (a.read !== undefined) up.read_at = a.read ? now : null;
    if (a.starred !== undefined) up.starred = a.starred;
    if (a.folder) up.folder = a.folder;
    const r = await db.from('immo_mail_messages').update(up).in('id', a.ids);
    return r.error ? j({ error: 'Speichern fehlgeschlagen.' }, 500) : j({ ok: true });
  }
  if (a.action === 'purge') {
    const { data: rows } = await db.from('immo_mail_messages').select('id, attachments').in('id', a.ids).eq('folder', 'trash');
    const paths = (rows ?? []).flatMap((r) => ((r.attachments as MailRow['attachments']) || []).map((x) => x.path));
    if (paths.length) await db.storage.from('mail').remove(paths);
    await db.from('immo_mail_messages').delete().in('id', (rows ?? []).map((r) => r.id));
    await adminAudit(actor, 'mail_purge', null, { n: rows?.length ?? 0 });
    return j({ ok: true });
  }
  if (a.action === 'send') {
    const { data: m } = await db.from('immo_mail_messages').select('*').eq('id', a.id).maybeSingle();
    if (!m) return j({ error: 'Nicht gefunden.' }, 404);
    const r = await sendRow(m as MailRow, actor);
    if (!r.ok) return j({ error: r.error }, r.status);
    await adminAudit(actor, 'mail_send', (m.to_emails as string[]).join(','), { id: a.id });
    return j({ ok: true });
  }
  if (a.action === 'uploadUrl' || a.action === 'attach' || a.action === 'detach') {
    const { data: m } = await db.from('immo_mail_messages').select('id, status, attachments, direction').eq('id', a.id).maybeSingle();
    if (!m || m.direction !== 'out' || m.status === 'gesendet') return j({ error: 'Nur bei Entwürfen möglich.' }, 409);
    const atts = (m.attachments as MailRow['attachments']) || [];
    if (a.action === 'uploadUrl') {
      const total = atts.reduce((s, x) => s + x.size, 0) + a.size;
      if (total > 25 * 1024 * 1024) return j({ error: 'Anhänge insgesamt höchstens 25 MB.' }, 413);
      const safe = a.name.replace(/[^\p{L}\p{N}._ -]+/gu, '_').slice(0, 120) || 'anhang';
      const path = `out/${a.id}/${Date.now()}-${safe}`;
      const s = await db.storage.from('mail').createSignedUploadUrl(path);
      return s.data ? j({ url: s.data.signedUrl, token: s.data.token, path }) : j({ error: 'Upload nicht möglich.' }, 502);
    }
    if (a.action === 'attach') {
      if (!a.path.startsWith(`out/${a.id}/`)) return j({ error: 'Ungültig.' }, 400);
      atts.push({ name: a.name.slice(0, 160), type: a.type || 'application/octet-stream', size: a.size, path: a.path });
    } else {
      const [gone] = atts.splice(a.index, 1);
      if (gone) await db.storage.from('mail').remove([gone.path]);
    }
    await db.from('immo_mail_messages').update({ attachments: atts, updated_at: now }).eq('id', a.id);
    return j({ ok: true, attachments: atts });
  }

  // Entwurf speichern (neu, Antwort oder Weiterleitung) – optional direkt senden oder Vorschau liefern.
  let row: Partial<MailRow> & { id: string };
  if (a.id) {
    const { data: m } = await db.from('immo_mail_messages').select('*').eq('id', a.id).maybeSingle();
    if (!m) return j({ error: 'Nicht gefunden.' }, 404);
    if (m.status === 'gesendet') return j({ error: 'Bereits gesendet.' }, 409);
    row = m as MailRow;
  } else {
    const id = randomUUID();
    row = { id, thread_id: id, direction: 'out', folder: 'drafts', status: 'entwurf', design: 'frei', from_email: mailboxAddress(), attachments: [] };
    const ref = a.replyTo || a.forward;
    if (ref) {
      const { data: o } = await db.from('immo_mail_messages').select('thread_id, message_id, refs, subject, attachments').eq('id', ref).maybeSingle();
      if (o) {
        if (a.replyTo) { row.thread_id = o.thread_id as string; row.in_reply_to = (o.message_id as string) || null; row.refs = [o.refs, o.message_id].filter(Boolean).join(' ').slice(-7900) || null; }
        if (a.forward) row.attachments = (o.attachments as MailRow['attachments']) || [];
      }
    }
  }
  const body = a.body !== undefined ? a.body : row.html || '';
  const up = {
    ...row, to_emails: a.to, cc_emails: a.cc || [], subject: a.subject.trim().slice(0, 300),
    html: row.design === 'fertig' ? row.html : body, with_unsub: a.withUnsub ?? row.with_unsub ?? !a.replyTo,
    text_body: row.design === 'fertig' ? row.text_body : htmlToText(sanitizeBody(body)), updated_at: now,
  };
  up.snippet = snippetOf(up.text_body || '');
  if (a.preview) {
    const { html } = await buildOutgoing({ ...(up as MailRow) }, true);
    return j({ ok: true, preview: html });
  }
  const w = await db.from('immo_mail_messages').upsert(up);
  if (w.error) return j({ error: 'Speichern fehlgeschlagen.' }, 500);
  if (!a.send) return j({ ok: true, id: row.id });
  const { data: fresh } = await db.from('immo_mail_messages').select('*').eq('id', row.id).single();
  const r = await sendRow(fresh as MailRow, actor);
  if (!r.ok) return j({ error: r.error, id: row.id }, r.status);
  await adminAudit(actor, 'mail_send', a.to.join(','), { id: row.id, thread: normSubject(a.subject).slice(0, 60) });
  return j({ ok: true, id: row.id, sent: true });
}
