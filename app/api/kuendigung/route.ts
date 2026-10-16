import { NextResponse } from 'next/server';
import { allowRequest } from '@/lib/security/rate-limit';

// Kündigungsbutton nach § 312k BGB.
// Versand per E-Mail über Resend (https://resend.com), konfiguriert über:
//   RESEND_API_KEY      – API-Schlüssel
//   CANCEL_FROM_EMAIL   – verifizierte Absenderadresse, z. B. "ImmoAdv <kuendigung@immoadv.de>"
//   CANCEL_TO_EMAIL     – Empfänger beim Betreiber (Standard: support@immoadv.de)

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clean = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const html = (t: string) => t.replace(/[&<>"]/g, (c) => ENT[c] ?? c);

async function send(key: string, from: string, to: string, subject: string, text: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html: `<pre style="font-family:Helvetica,Arial,sans-serif">${html(text)}</pre>` }),
  });
  if (!r.ok) throw new Error(`Mailversand fehlgeschlagen (${r.status})`);
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allowRequest(`kuendigung:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte in einer Minute erneut versuchen.' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const contract = clean(body.contract, 120) || 'ImmoAdv-Abo';
  const type = body.type === 'ausserordentlich' ? 'außerordentlich' : 'ordentlich';
  const reason = clean(body.reason, 2000);
  if (!name || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Bitte Name und gültige E-Mail-Adresse angeben.' }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.CANCEL_FROM_EMAIL;
  const to = process.env.CANCEL_TO_EMAIL || 'support@immoadv.de';
  if (!key || !from) {
    return NextResponse.json(
      { error: 'Die Online-Kündigung ist gerade nicht erreichbar. Bitte kündigen Sie formlos per E-Mail an support@immoadv.de – das ist ebenso wirksam.' },
      { status: 503 },
    );
  }

  const receivedAt = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'long', timeStyle: 'medium', timeZone: 'Europe/Berlin',
  }).format(new Date()) + ' Uhr (MEZ/MESZ)';

  const text = [
    'Kündigungserklärung',
    '',
    `Eingang: ${receivedAt}`,
    `Name: ${name}`,
    `E-Mail: ${email}`,
    `Vertrag: ${contract}`,
    `Art: ${type} Kündigung, zum nächstmöglichen Zeitpunkt`,
    reason ? `Grund: ${reason}` : '',
  ].filter(Boolean).join('\n');

  try {
    await send(key, from, to, `Kündigung: ${contract} – ${name}`, text);
    await send(key, from, email, 'Bestätigung Ihrer Kündigung bei ImmoAdv',
      `Guten Tag ${name},\n\nwir haben Ihre Kündigung erhalten.\n\n${text}\n\nImmoAdv · Feray Korkmaz · Georg-August-Zinn-Str. 25 · 64354 Reinheim`);
  } catch {
    return NextResponse.json(
      { error: 'Die Kündigung konnte nicht übermittelt werden. Bitte kündigen Sie per E-Mail an support@immoadv.de.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, receivedAt });
}
