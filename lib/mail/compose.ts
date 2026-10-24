import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BRAND_IMAGES, resendSend, mailboxAddress, type OutAttachment } from '@/lib/mail/resend';
import { esc, fillTemplate, htmlToText, renderBrief, sanitizeBody, wrapDocument } from '@/lib/mail/template';
import { isSuppressed } from '@/lib/marketing/suppression';

// Ausgehende Nachricht aus einem Entwurf bauen und senden.
export type MailRow = {
  id: string; thread_id: string; direction: 'in' | 'out'; folder: string; status: string | null; design: 'frei' | 'fertig' | 'eingang';
  from_email: string; from_name: string | null; to_emails: string[]; cc_emails: string[]; subject: string; html: string | null; text_body: string | null;
  termin_fallback: string | null; token: string | null; with_unsub: boolean; message_id: string | null; in_reply_to: string | null; refs: string | null;
  attachments: { name: string; type: string; size: number; path: string; cid?: string | null; inline?: boolean }[]; contact_id: string | null;
  created_at: string; sent_at: string | null; received_at: string | null; snippet: string | null; read_at: string | null; starred: boolean;
};
const BOOKING = 'outreach_booking_url';
export const unsubUrl = (t: string | null) => (t ? `https://immoadv.de/api/abmelden?t=${t}` : null);

export async function bookingUrl(): Promise<string | null> {
  const { data } = await supabaseAdmin().from('immo_settings').select('value').eq('key', BOOKING).maybeSingle();
  return typeof data?.value === 'string' && /^https:\/\//.test(data.value) ? data.value : null;
}

// Abmeldelink je Empfänger (nur bei genau einem Empfänger, sonst ohne Link).
export async function ensureToken(m: MailRow): Promise<string | null> {
  if (!m.with_unsub || m.to_emails.length !== 1) return null;
  const email = m.to_emails[0];
  if (m.token) return m.token;
  const db = supabaseAdmin();
  const { data } = await db.from('immo_outreach_links').select('token').eq('email', email).is('opted_out_at', null).limit(1);
  const t = (data?.[0]?.token as string) || randomBytes(18).toString('base64url');
  if (!data?.[0]) await db.from('immo_outreach_links').insert({ token: t, email, label: m.subject.slice(0, 160) || 'E-Mail' });
  await db.from('immo_mail_messages').update({ token: t }).eq('id', m.id);
  return t;
}

async function quoteOf(m: MailRow) {
  if (!m.in_reply_to) return null;
  const { data } = await supabaseAdmin().from('immo_mail_messages').select('from_email, from_name, text_body, received_at, sent_at, created_at').eq('message_id', m.in_reply_to).limit(1);
  const q = data?.[0];
  if (!q) return null;
  const d = new Date((q.received_at || q.sent_at || q.created_at) as string);
  return { from: q.from_name ? `${q.from_name} <${q.from_email}>` : (q.from_email as string), date: d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' }), text: String(q.text_body || '') };
}

// Fertiges HTML + Text. preview=true: Bilder über öffentliche Adressen statt cid (für die Vorschau im Browser).
export async function buildOutgoing(m: MailRow, preview = false): Promise<{ html: string; text: string; unsub: string | null }> {
  const token = preview ? m.token : await ensureToken(m);
  const unsub = token ? unsubUrl(token) : null;
  let inner: string, text: string;
  if (m.design === 'fertig') {
    inner = fillTemplate(m.html || '', await bookingUrl(), m.termin_fallback);
    if (token && m.token && token !== m.token) inner = inner.split(m.token).join(token);
    text = m.text_body || htmlToText(inner);
  } else {
    const body = sanitizeBody(m.html || '');
    const quote = await quoteOf(m);
    inner = renderBrief({ body, unsubUrl: unsub, quote });
    text = `${htmlToText(body)}\n\nViele Grüße\nFeray Korkmaz\nHead of Operations · ImmoAdv\nhttps://immoadv.de · ${mailboxAddress()}${quote ? `\n\nAm ${quote.date} schrieb ${quote.from}:\n> ${quote.text.slice(0, 4000).split('\n').join('\n> ')}` : ''}\n\nImpressum: https://immoadv.de/impressum${unsub ? `\nKeine E-Mails mehr erhalten? Abmelden: ${unsub}` : ''}`;
  }
  let html = wrapDocument(m.subject, inner, text);
  if (preview) for (const a of BRAND_IMAGES) html = html.split(`cid:${a.content_id}`).join(a.path);
  return { html, text, unsub };
}

export async function sendRow(m: MailRow, actor: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const db = supabaseAdmin();
  if (m.direction !== 'out' || m.status === 'gesendet') return { ok: false, error: 'Diese E-Mail wurde bereits gesendet.', status: 409 };
  if (!m.to_emails.length) return { ok: false, error: 'Bitte einen Empfänger angeben.', status: 400 };
  if (!m.subject.trim()) return { ok: false, error: 'Bitte einen Betreff angeben.', status: 400 };
  const blocked = await isSuppressed(m.to_emails.map((email) => ({ email }))).catch(() => m.to_emails.map(() => false));
  const bad = m.to_emails.filter((_e, i) => blocked[i]);
  if (bad.length) { await db.from('immo_mail_messages').update({ status: 'gesperrt', error: `Abgemeldet/Widerspruch: ${bad.join(', ')}`.slice(0, 500) }).eq('id', m.id); return { ok: false, error: `Nicht gesendet – abgemeldet bzw. Werbewiderspruch: ${bad.join(', ')}`, status: 409 }; }
  const { html, text, unsub } = await buildOutgoing(m);
  const files: OutAttachment[] = [];
  for (const a of m.attachments || []) {
    const { data } = await db.storage.from('mail').download(a.path);
    if (data) files.push({ filename: a.name, content: Buffer.from(await data.arrayBuffer()).toString('base64'), content_type: a.type });
  }
  const res = await resendSend({ to: m.to_emails, cc: m.cc_emails, subject: m.subject, html, text, unsubUrl: unsub, inReplyTo: m.in_reply_to, references: m.refs, files, idemKey: `mail:${m.id}` });
  if (!res.ok) { await db.from('immo_mail_messages').update({ status: 'fehler', error: res.error.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', m.id); return { ok: false, error: res.error, status: 502 }; }
  const now = new Date().toISOString();
  await db.from('immo_mail_messages').update({ status: 'gesendet', folder: 'sent', error: null, resend_id: res.id, sent_at: now, sent_by: actor, updated_at: now, from_email: mailboxAddress(), snippet: text.replace(/\s+/g, ' ').slice(0, 220) }).eq('id', m.id);
  // Akquise: Kontakt anlegen bzw. fortschreiben und Verlauf protokollieren.
  for (const email of m.to_emails) {
    const { data: cs } = await db.from('immo_crm_contacts').select('id, status').ilike('email', email);
    let ids = (cs ?? []).map((c) => c.id as string);
    if (!ids.length) {
      const ins = await db.from('immo_crm_contacts').insert({ kind: 'sonstige', company: (email.split('@')[1] || email).slice(0, 160), email, status: 'angeschrieben', source: 'E-Mail aus dem Postfach' }).select('id').single();
      if (ins.data) ids = [ins.data.id as string];
    } else await db.from('immo_crm_contacts').update({ status: 'angeschrieben', updated_at: now }).in('id', ids).eq('status', 'neu');
    if (ids.length) await db.from('immo_crm_activities').insert(ids.map((cid) => ({ contact_id: cid, type: 'email', note: `Gesendet: ${m.subject}`.slice(0, 1000), actor })));
    if (ids[0] && !m.contact_id) await db.from('immo_mail_messages').update({ contact_id: ids[0] }).eq('id', m.id);
  }
  return { ok: true };
}

export const escHtml = esc;
