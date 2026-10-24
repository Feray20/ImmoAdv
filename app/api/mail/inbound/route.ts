import { NextResponse } from 'next/server';
import { adminConfigured } from '@/lib/supabase/admin';
import { verifyWebhook } from '@/lib/mail/resend';
import { ingestReceived } from '@/lib/mail/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Eingang aller E-Mails an @immoadv.de (Resend Receiving, Webhook „email.received“).
// Signatur wird geprüft (RESEND_INBOUND_SECRET); Inhalt und Anhänge werden über die Receiving-API geholt und
// im privaten Speicher „mail“ abgelegt. Doppelte Zustellung desselben Webhooks legt nichts doppelt an.

export async function POST(req: Request) {
  const secret = process.env.RESEND_INBOUND_SECRET || process.env.RESEND_WEBHOOK_SECRET || '';
  const body = await req.text();
  if (!secret || !verifyWebhook(body, req.headers, secret)) return NextResponse.json({ error: 'Signatur ungültig.' }, { status: 401 });
  if (!adminConfigured()) return NextResponse.json({ error: 'Nicht konfiguriert.' }, { status: 503 });
  let ev: { type?: string; data?: { email_id?: string } } = {};
  try { ev = JSON.parse(body); } catch { return NextResponse.json({ ok: true }); }
  if (ev.type !== 'email.received' || !ev.data?.email_id) return NextResponse.json({ ok: true });
  const res = await ingestReceived(ev.data.email_id);
  if (res === 'error') return NextResponse.json({ error: 'Verarbeitung fehlgeschlagen.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
