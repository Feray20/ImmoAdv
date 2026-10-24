import { NextResponse } from 'next/server';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { headerValue, mailboxAddress, parseAddress, resendGetReceived, resendListReceivedAttachments, verifyWebhook } from '@/lib/mail/resend';
import { contactFor, findThread, snippetOf } from '@/lib/mail/store';
import { htmlToText } from '@/lib/mail/template';
import { adminList } from '@/lib/security/admin';
import { mailConfigured, sendMail } from '@/lib/notify/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Eingang aller E-Mails an @immoadv.de (Resend Receiving, Webhook „email.received“).
// Signatur wird geprüft (RESEND_INBOUND_SECRET); Inhalt und Anhänge werden über die Receiving-API geholt und
// im privaten Speicher „mail“ abgelegt. Doppelte Zustellung desselben Webhooks legt nichts doppelt an.
const MAX_FILE = 20 * 1024 * 1024;

export async function POST(req: Request) {
  const secret = process.env.RESEND_INBOUND_SECRET || process.env.RESEND_WEBHOOK_SECRET || '';
  const body = await req.text();
  if (!secret || !verifyWebhook(body, req.headers, secret)) return NextResponse.json({ error: 'Signatur ungültig.' }, { status: 401 });
  if (!adminConfigured()) return NextResponse.json({ error: 'Nicht konfiguriert.' }, { status: 503 });
  let ev: { type?: string; data?: { email_id?: string } } = {};
  try { ev = JSON.parse(body); } catch { return NextResponse.json({ ok: true }); }
  if (ev.type !== 'email.received' || !ev.data?.email_id) return NextResponse.json({ ok: true });
  const rid = ev.data.email_id;
  const db = supabaseAdmin();
  const { data: dup } = await db.from('immo_mail_messages').select('id').eq('resend_id', rid).maybeSingle();
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  const m = await resendGetReceived(rid);
  if (!m) return NextResponse.json({ error: 'Nachricht nicht abrufbar.' }, { status: 502 });
  const from = parseAddress(m.from);
  const to = (m.to || []).map((x) => parseAddress(x).email).filter(Boolean);
  const cc = (m.cc || []).map((x) => parseAddress(x).email).filter(Boolean);
  const messageId = m.message_id || headerValue(m.headers, 'message-id');
  const inReplyTo = headerValue(m.headers, 'in-reply-to');
  const refs = headerValue(m.headers, 'references');
  const text = m.text || htmlToText(m.html || '');
  const a = m.authentication || {};
  const failed = (v?: string) => typeof v === 'string' && /fail/i.test(v);
  const spam = failed(a.dmarc) && (failed(a.spf) || failed(a.dkim));
  const threadId = await findThread({ inReplyTo, refs, subject: m.subject || '', counterpart: from.email });
  const id = crypto.randomUUID();

  // Anhänge sichern (Download-Links von Resend laufen ab).
  const files: { name: string; type: string; size: number; path: string; cid: string | null; inline: boolean }[] = [];
  try {
    for (const att of await resendListReceivedAttachments(rid)) {
      if (!att.download_url || att.size > MAX_FILE) continue;
      const r = await fetch(att.download_url, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const safe = (att.filename || 'anhang').replace(/[^\p{L}\p{N}._ -]+/gu, '_').slice(0, 120) || 'anhang';
      const path = `in/${id}/${files.length}-${safe}`;
      const up = await db.storage.from('mail').upload(path, buf, { contentType: att.content_type || 'application/octet-stream', upsert: true });
      if (up.error) continue;
      files.push({ name: safe, type: att.content_type || 'application/octet-stream', size: buf.length, path, cid: att.content_id ? String(att.content_id).replace(/^<|>$/g, '') : null, inline: att.content_disposition === 'inline' });
    }
  } catch (e) { console.error('mail_inbound_att', (e as Error).message); }

  const contactId = await contactFor(from.email);
  const ins = await db.from('immo_mail_messages').insert({
    id, thread_id: threadId, direction: 'in', folder: spam ? 'spam' : 'inbox', design: 'eingang',
    from_email: from.email.slice(0, 320), from_name: from.name, to_emails: to, cc_emails: cc, subject: (m.subject || '(ohne Betreff)').slice(0, 500),
    html: m.html ? m.html.slice(0, 2_000_000) : null, text_body: text.slice(0, 500_000), snippet: snippetOf(text),
    message_id: messageId, in_reply_to: inReplyTo, refs, resend_id: rid, attachments: files, auth: a, contact_id: contactId,
    received_at: m.created_at || new Date().toISOString(), source: 'resend-inbound',
  });
  if (ins.error) { console.error('mail_inbound_insert', ins.error.message); return NextResponse.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 }); }
  if (contactId) await db.from('immo_crm_activities').insert({ contact_id: contactId, type: 'email', note: `Eingang: ${(m.subject || '').slice(0, 200)}`, actor: 'postfach' });

  // Hinweis an die Admins (nur an externe Adressen – keine Schleife über das eigene Postfach).
  if (!spam && mailConfigured()) {
    const own = mailboxAddress().split('@')[1];
    for (const adm of adminList()) {
      if (adm.endsWith('@' + own)) continue;
      await sendMail(adm, `Neue E-Mail: ${(m.subject || '(ohne Betreff)').slice(0, 120)}`, `Von: ${from.name ? `${from.name} <${from.email}>` : from.email}\n\n${snippetOf(text)}\n\nIm Web-Admin öffnen:\nhttps://immoadv.de/intern/web-admin#postfach`).catch(() => false);
    }
  }
  return NextResponse.json({ ok: true });
}
