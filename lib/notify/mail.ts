// E-Mail-Versand über Resend – jede E-Mail im ImmoAdv-Design (Logo, Absendername „ImmoAdv“, Fußzeile mit Anbieterangaben).
// Ohne RESEND_API_KEY und NOTIFY_FROM_EMAIL (bzw. CANCEL_FROM_EMAIL) wird nichts versendet.
// Zustellung: Empfänger wird geprüft und normalisiert; bei 429/5xx genau ein erneuter Versuch mit demselben
// Idempotency-Key (keine Doppelzustellung). Fehler werden ohne Empfängeradresse protokolliert.
import { createHash } from 'node:crypto';
const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const html = (t: string) => t.replace(/[&<>"]/g, (c) => ENT[c] ?? c);

const SITE = 'https://immoadv.de';
const LOGO = `${SITE}/brand/immoadv-mail-logo.png`;
const HEADER = `${SITE}/brand/mail-header.jpg`; // Logo im Farbverlauf (Kopf)
const BAR = `${SITE}/brand/mail-bar.png`; // Verlaufsleiste wie im Logo
const ICON = `${SITE}/brand/mail-icon.png`; // Symbol in der Signatur

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && (process.env.NOTIFY_FROM_EMAIL || process.env.CANCEL_FROM_EMAIL));
}

// Absender immer als „ImmoAdv <adresse>“ – auch wenn in Vercel nur die Adresse eingetragen ist.
// Unternehmenskunden (area 'b2b') erhalten Mails als „ImmoAdv Business“ – getrennt vom Privatkundenbereich.
export type MailArea = 'b2c' | 'b2b';
export function fromAddress(area: MailArea = 'b2c'): string {
  const raw = (process.env.NOTIFY_FROM_EMAIL || process.env.CANCEL_FROM_EMAIL || '').trim();
  if (!raw) return '';
  const name = area === 'b2b' ? 'ImmoAdv Business' : 'ImmoAdv';
  if (/<[^>]+>/.test(raw)) return raw.replace(/^[^<]*</, `${name} <`);
  return `${name} <${raw}>`;
}

export type Attachment = { filename: string; content: Uint8Array | Buffer };
export type MailButton = { label: string; url: string };

// Text in gebrandetes HTML umwandeln: Absätze, Links klickbar, alleinstehende ImmoAdv-Links als Knopf.
function bodyHtml(text: string): string {
  const linkify = (s: string) => html(s).replace(/(https:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#0284C7;text-decoration:underline">${u}</a>`);
  return text.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n');
    if (lines.length === 1 && /^https:\/\/immoadv\.de\S*$/.test(lines[0].trim())) {
      return buttonHtml({ label: 'Öffnen', url: lines[0].trim() });
    }
    // Zeilen im Stil „Bezeichnung: Wert“ als kompakte Liste
    if (lines.length > 2 && lines.filter((l) => /^[^:]{2,40}:\s/.test(l)).length >= lines.length - 1) {
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 16px">${lines.map((l) => {
        const m = /^([^:]{2,40}):\s(.*)$/.exec(l);
        return m ? `<tr><td style="padding:5px 12px 5px 0;color:#64748B;font-size:14px;vertical-align:top;white-space:nowrap">${html(m[1])}</td><td style="padding:5px 0;color:#0F172A;font-size:14px;font-weight:600">${linkify(m[2])}</td></tr>`
          : `<tr><td colspan="2" style="padding:8px 0 4px;color:#0F2C59;font-size:13px;font-weight:700;letter-spacing:.04em">${linkify(l)}</td></tr>`;
      }).join('')}</table>`;
    }
    return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1E293B">${lines.map(linkify).join('<br>')}</p>`;
  }).join('');
}

// Knopf plus kleiner Ersatzlink darunter (für Programme, die Knöpfe ausblenden oder Links umschreiben).
// Pillenform wie auf der Website; Farbe per bgcolor (Gmail entfernt Hintergrundbilder und -verläufe).
function buttonHtml(b: MailButton, accent = '#0F2C59'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 8px"><tr><td bgcolor="${accent}" style="background-color:${accent};border-radius:999px"><a href="${html(b.url)}" style="display:inline-block;padding:15px 30px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${html(b.label)}&nbsp;→</a></td></tr></table>
<p style="margin:0 0 22px;font-size:12px;line-height:1.5;color:#64748B;word-break:break-all">Falls der Knopf nicht funktioniert: <a href="${html(b.url)}" style="color:#64748B">${html(b.url.replace(/^https:\/\//, ''))}</a></p>`;
}

// Vollständiges gebrandetes E-Mail-HTML (Standard für alle Mails von ImmoAdv).
// Aufbau: Kopf mit Logo im Farbverlauf (gehostetes Bild) · Verlaufsleiste · Inhalt · Signatur mit Symbol · Fußzeile.
// Nur Gestaltungsmittel, die Gmail/Apple Mail/Outlook stehen lassen (bgcolor, background-color, gehostete Bilder).
// accent: Hausfarbe eines Unternehmenskunden (Co-Branding der Kundeneinladung) – dann neutraler weißer Kopf mit Akzentleiste.
export function brandedHtml({ title, text, button, note, area = 'b2c', accent }: { title?: string; text: string; button?: MailButton; note?: string; area?: MailArea; accent?: string }): string {
  const biz = area === 'b2b';
  const custom = Boolean(accent && /^#[0-9a-fA-F]{6}$/.test(accent));
  const ac = custom ? (accent as string) : '#0F2C59';
  const home = biz ? `${SITE}/b2b-portal` : SITE;
  const pre = html((text.split('\n').find((l) => l.trim()) || '').slice(0, 120)) + '&#8199;&#65279;&#847;'.repeat(30);
  const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const head = custom
    ? `<tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:24px 28px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td><a href="${home}" style="text-decoration:none"><img src="${LOGO}" width="180" height="36" alt="ImmoAdv" style="display:block;border:0;width:180px;height:auto"></a></td>${biz ? `<td align="right" style="${F};font-size:12px;font-weight:700;letter-spacing:.06em;color:#0369A1;text-transform:uppercase">Unternehmensportal</td>` : ''}</tr></table></td></tr>
<tr><td height="5" bgcolor="${ac}" style="background-color:${ac};height:5px;line-height:5px;font-size:0">&nbsp;</td></tr>`
    : `<tr><td bgcolor="#0F2C59" style="background-color:#0F2C59;padding:0;line-height:0;font-size:0"><a href="${home}" style="text-decoration:none"><img src="${HEADER}" width="600" alt="ImmoAdv" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:#FFFFFF;font-size:22px;font-weight:800"></a></td></tr>
${biz ? `<tr><td bgcolor="#0F2C59" style="background-color:#0F2C59;padding:0 28px 14px;${F};font-size:12px;font-weight:700;letter-spacing:.08em;color:#7DD3FC;text-transform:uppercase">Unternehmensportal</td></tr>` : ''}
<tr><td style="padding:0;line-height:0;font-size:0"><img src="${BAR}" width="600" height="5" alt="" style="display:block;width:100%;max-width:600px;height:5px;border:0"></td></tr>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${html(title || 'ImmoAdv')}</title></head>
<body style="margin:0;padding:0;background-color:#EEF2F7;${F}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${pre}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EEF2F7" style="background-color:#EEF2F7"><tr><td align="center" style="padding:24px 10px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="max-width:600px;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #E2E8F0">
${head}
<tr><td style="padding:30px 28px 8px;${F}">
${title ? `<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;font-weight:800;color:#0F2C59">${html(title)}</h1>` : ''}
${bodyHtml(text)}
${button ? buttonHtml(button, ac) : ''}
${note ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#64748B">${html(note)}</p>` : ''}
</td></tr>
<tr><td style="padding:8px 28px 26px;${F}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#E2E8F0" style="background-color:#E2E8F0;font-size:0;line-height:1px">&nbsp;</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px"><tr>
<td valign="middle" width="56" style="padding:0 14px 0 0"><img src="${ICON}" width="56" height="56" alt="ImmoAdv" style="display:block;width:56px;height:56px;border:0"></td>
<td valign="middle" style="font-size:14px;line-height:21px;color:#64748B"><strong style="display:block;font-size:16px;line-height:22px;color:#0F2C59">Feray Korkmaz</strong>Head of Operations · ImmoAdv<br><a href="mailto:support@immoadv.de" style="color:#0284C7;text-decoration:none;font-weight:700">support@immoadv.de</a></td>
</tr></table>
</td></tr>
<tr><td bgcolor="#F8FAFC" style="background-color:#F8FAFC;border-top:1px solid #E2E8F0;padding:18px 28px 22px;${F};font-size:12px;line-height:19px;color:#94A3B8">
ImmoAdv · Feray Korkmaz · Georg-August-Zinn-Str. 25 · 64354 Reinheim<br>${biz ? `<a href="${SITE}/b2b-portal" style="color:#94A3B8;text-decoration:underline">Unternehmensportal</a> · ` : ''}<a href="${SITE}/impressum" style="color:#94A3B8;text-decoration:underline">Impressum</a> · <a href="${SITE}/datenschutz" style="color:#94A3B8;text-decoration:underline">Datenschutz</a><br>
Technisches Analyse- und Vorbereitungswerkzeug – keine Kreditvermittlung, keine Anlage-, Steuer- oder Rechtsberatung.
</td></tr>
</table></td></tr></table></body></html>`;
}

// sender: Anzeigename „<Firma> über ImmoAdv“ (Adresse bleibt die von ImmoAdv); accent: Hausfarbe im HTML.
export type MailOptions = { title?: string; button?: MailButton; note?: string; replyTo?: string; headers?: Record<string, string>; area?: MailArea; sender?: string; accent?: string };

// Empfängeradresse prüfen (eine Adresse, keine Header-Injektion) und normalisieren.
export function normalizeRecipient(to: string): string | null {
  const t = String(to || '').trim().toLowerCase();
  return /^[^\s@<>,;"]{1,64}@[^\s@<>,;"]{1,190}\.[a-z0-9-]{2,63}$/.test(t) ? t : null;
}

export async function sendMail(to: string, subject: string, text: string, attachments: Attachment[] = [], opts: MailOptions = {}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const base = fromAddress(opts.area);
  const sn = (opts.sender || '').replace(/["<>\r\n,;\\]/g, '').trim().slice(0, 60);
  const from = sn && base ? base.replace(/^[^<]*</, `"${sn} über ImmoAdv" <`) : base;
  const rcpt = normalizeRecipient(to);
  if (!key || !from || !rcpt) return false;
  const subj = subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 180);
  const plain = text + (opts.button ? `\n\n${opts.button.label}: ${opts.button.url}` : '') + '\n\n—\n' + (opts.area === 'b2b' ? 'ImmoAdv Business · Unternehmensportal: https://immoadv.de/b2b-portal\n' : '') + 'ImmoAdv · Georg-August-Zinn-Str. 25 · 64354 Reinheim · support@immoadv.de · https://immoadv.de/impressum';
  const body = JSON.stringify({
    from, to: [rcpt], subject: subj, text: plain,
    html: brandedHtml({ title: opts.title, text, button: opts.button, note: opts.note, area: opts.area, accent: opts.accent }),
    reply_to: opts.replyTo || 'support@immoadv.de',
    ...(opts.headers ? { headers: opts.headers } : {}),
    ...(attachments.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64') })) } : {}),
  });
  // Gleiche Mail an dieselbe Adresse innerhalb von 10 Minuten wird von Resend nur einmal zugestellt.
  const idem = createHash('sha256').update(`${rcpt}\n${subj}\n${text}\n${Math.floor(Date.now() / 600000)}`).digest('hex').slice(0, 48);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idem },
        body,
        signal: AbortSignal.timeout(attachments.length ? 30000 : 8000),
      });
      if (r.ok) return true;
      if (attempt === 0 && (r.status === 429 || r.status >= 500)) { await new Promise((res) => setTimeout(res, 800)); continue; }
      console.warn(`[mail] Versand fehlgeschlagen: HTTP ${r.status} (${subj.slice(0, 60)})`);
      return false;
    } catch (e) {
      if (attempt === 0) { await new Promise((res) => setTimeout(res, 800)); continue; }
      console.warn(`[mail] Versand fehlgeschlagen: ${(e as Error)?.name || 'Fehler'} (${subj.slice(0, 60)})`);
      return false;
    }
  }
  return false;
}
