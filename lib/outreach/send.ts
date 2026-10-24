import { createHash } from 'node:crypto';
import { normalizeRecipient } from '@/lib/notify/mail';

// Persönliche Akquise-E-Mails (Presse, Blogs, Kooperationen) – Einzelversand aus dem Web-Admin über Resend.
// Bilder (Foto, Logo, Unterschrift) gehen als eingebettete Anhänge (cid) mit, damit sie in jedem Programm ohne
// „Bilder laden“ erscheinen; Links bleiben unverändert (kein Umschreiben, keine Weiterleitung).
// Kopfzeilen List-Unsubscribe (+ One-Click) zeigen in Gmail und Apple Mail den Abmelden-Knopf an.
const SITE = 'https://immoadv.de';
export const OUTREACH_IMAGES = [
  { content_id: 'att0', filename: 'feray-korkmaz.png', path: `${SITE}/img/mail/foto.png` },
  { content_id: 'att1', filename: 'immoadv.png', path: `${SITE}/img/mail/logo.png` },
  { content_id: 'att2', filename: 'unterschrift.png', path: `${SITE}/img/mail/unterschrift.png` },
];

export function outreachFrom(): string {
  const addr = (process.env.OUTREACH_FROM_EMAIL || 'support@immoadv.de').replace(/^.*<([^>]+)>.*$/, '$1').trim();
  return `Feray Korkmaz · ImmoAdv <${addr}>`;
}

// Platzhalter füllen: Terminlink (Google-Terminbuchung aus dem Web-Admin, sonst vorbereitete Antwort-Mail).
export function fillTemplate(html: string, termin: string | null, fallback: string | null): string {
  const url = termin || fallback || 'mailto:support@immoadv.de?subject=Terminvorschlag';
  return html.split('{{TERMIN_URL}}').join(url.replace(/&/g, '&amp;').replace(/"/g, '&quot;'));
}

// Fertiges Dokument: Kopf mit color-scheme (verhindert ungewolltes Umfärben) und unsichtbarer Vorschauzeile.
export function wrapDocument(subject: string, inner: string, preview: string): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#eef2f7;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preview.slice(0, 140))}${'&#8199;&#65279;&#847;'.repeat(30)}</div>
${inner}
</body></html>`;
}

export async function sendOutreach(o: { to: string; subject: string; html: string; text: string; unsubUrl: string | null }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  const to = normalizeRecipient(o.to);
  if (!key) return { ok: false, error: 'E-Mail-Versand ist nicht eingerichtet (RESEND_API_KEY fehlt).' };
  if (!to) return { ok: false, error: 'Empfängeradresse ungültig.' };
  const headers: Record<string, string> = {};
  if (o.unsubUrl) {
    headers['List-Unsubscribe'] = `<${o.unsubUrl}>, <mailto:support@immoadv.de?subject=Abmelden>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  const subject = o.subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 180);
  const body = JSON.stringify({
    from: outreachFrom(), to: [to], subject, html: o.html, text: o.text, reply_to: 'support@immoadv.de', headers,
    attachments: OUTREACH_IMAGES.map((a) => ({ path: a.path, filename: a.filename, content_id: a.content_id })),
  });
  const idem = createHash('sha256').update(`outreach\n${to}\n${subject}`).digest('hex').slice(0, 48);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idem }, body, signal: AbortSignal.timeout(20000),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (r.ok && j.id) return { ok: true, id: j.id };
    return { ok: false, error: `Versand abgelehnt (HTTP ${r.status})${j.message ? `: ${String(j.message).slice(0, 160)}` : ''}` };
  } catch (e) {
    return { ok: false, error: `Versand fehlgeschlagen: ${(e as Error)?.name || 'Fehler'}` };
  }
}
