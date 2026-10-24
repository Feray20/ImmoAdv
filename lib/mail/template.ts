// ImmoAdv-Briefvorlage für alle E-Mails aus dem Web-Admin-Postfach.
// Tabellen-Layout mit Inline-Styles (Gmail, Apple Mail, Outlook Desktop/Web, Android, iOS), Bilder als eingebettete
// Anhänge (cid:att0 Foto, cid:att1 Logo, cid:att2 Unterschrift), feste helle Farben (color-scheme: light only).
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const SITE = 'https://immoadv.de';
const F = 'font-family:Helvetica,Arial,sans-serif';

// ---------- Editor-Inhalt bereinigen (Whitelist) und für E-Mail-Programme stylen ----------
const STYLE: Record<string, string> = {
  p: `margin:0 0 16px;${F};font-size:16px;line-height:26px;color:#1e293b`,
  h2: `margin:8px 0 12px;${F};font-size:21px;line-height:28px;font-weight:800;color:#0f2c59`,
  h3: `margin:8px 0 10px;${F};font-size:17px;line-height:24px;font-weight:700;color:#0f2c59`,
  ul: `margin:0 0 16px;padding:0 0 0 22px;${F};font-size:16px;line-height:26px;color:#1e293b`,
  ol: `margin:0 0 16px;padding:0 0 0 22px;${F};font-size:16px;line-height:26px;color:#1e293b`,
  li: 'margin:0 0 6px',
  blockquote: `margin:0 0 16px;padding:12px 16px;border-left:3px solid #38bdf8;background-color:#f0f9ff;${F};font-size:15px;line-height:24px;color:#334155`,
  a: 'color:#0284c7;text-decoration:underline',
  strong: 'font-weight:700;color:#0f172a', b: 'font-weight:700;color:#0f172a', em: 'font-style:italic', i: 'font-style:italic', u: 'text-decoration:underline',
};
const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote']);
const BLOCK = new Set(['p', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote']);
const MAP: Record<string, string> = { div: 'p', h1: 'h2', h4: 'h3', h5: 'h3', h6: 'h3' };

export function sanitizeBody(input: string): string {
  let s = String(input || '').slice(0, 400000);
  s = s.replace(/<(script|style|head|title|iframe|object|svg|math|template)[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const out: string[] = [];
  const stack: string[] = [];
  let autoP = false;
  const re = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[3] !== undefined) {
      if (!stack.length && m[3].trim()) { out.push(`<p style="${STYLE.p}">`); stack.push('p'); autoP = true; }
      out.push(m[3].replace(/</g, '&lt;').replace(/>/g, '&gt;')); continue;
    }
    const closing = m[0].startsWith('</');
    let tag = m[1].toLowerCase();
    tag = MAP[tag] || tag;
    if (!ALLOWED.has(tag)) continue;
    if (tag === 'br') { if (!closing && stack.length) out.push('<br>'); continue; }
    if (closing) {
      const i = stack.lastIndexOf(tag);
      if (i === -1) continue;
      while (stack.length > i) out.push(`</${stack.pop()}>`);
      continue;
    }
    let attrs = '';
    if (tag === 'a') {
      const h = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[2]);
      const href = (h ? (h[2] ?? h[3] ?? h[4] ?? '') : '').replace(/&amp;/g, '&').trim();
      if (!/^(https:\/\/|http:\/\/|mailto:|tel:)/i.test(href)) continue;
      attrs = ` href="${esc(href)}" target="_blank"`;
    }
    if (BLOCK.has(tag) && tag !== 'li' && stack[0] === 'p' && stack.length === 1 && autoP) { out.push('</p>'); stack.pop(); autoP = false; }
    if (!BLOCK.has(tag) && !stack.length) { out.push(`<p style="${STYLE.p}">`); stack.push('p'); autoP = true; }
    out.push(`<${tag}${attrs} style="${STYLE[tag] || ''}">`);
    stack.push(tag);
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  // Text ohne Absatz in einen Absatz packen, leere Absätze entfernen.
  let html = out.join('').replace(/<p style="[^"]*">(\s|&nbsp;|<br>)*<\/p>/g, '');
  if (!/^\s*<(p|h2|h3|ul|ol|blockquote)\b/.test(html)) html = `<p style="${STYLE.p}">${html}</p>`;
  return html;
}

export function htmlToText(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h2|h3|blockquote|ul|ol|table)>/gi, '\n\n').replace(/<\/(li|tr)>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_x, href, t) => { const tt = t.replace(/<[^>]+>/g, ''); return href.startsWith('mailto:') || tt.includes(href) ? tt : `${tt} (${href})`; })
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- Bausteine ----------
const HEADER = `<tr><td class="ia-pad" style="padding:22px 28px 18px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="padding:0 10px 0 0"><a href="${SITE}" style="text-decoration:none"><img src="cid:att1" width="36" height="31" alt="ImmoAdv" style="display:block;width:36px;height:31px;border:0"></a></td><td valign="middle" style="${F};font-size:24px;line-height:28px;font-weight:800;color:#0f2c59"><a href="${SITE}" style="text-decoration:none;color:#0f2c59">Immo<span style="color:#0284c7">Adv</span></a></td></tr></table></td></tr>
<tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:#e2e8f0">&nbsp;</td></tr>`;

// Handschriftliche Unterschrift (3-fache Auflösung, angezeigt 117×46).
export const SIG_IMG = '<img src="cid:att2" width="117" height="46" alt="Feray Korkmaz" style="display:block;width:117px;height:46px;border:0;margin:0 0 6px;color:#0369a1;font-size:16px">';
export const SIGNATURE = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" width="72" style="width:72px;min-width:72px;padding:0;vertical-align:middle"><img src="cid:att0" width="72" height="72" alt="Feray Korkmaz" style="display:block;width:72px;height:72px;max-width:72px;border:0;border-radius:36px;-ms-interpolation-mode:bicubic"></td><td width="16" style="width:16px;min-width:16px;font-size:0;line-height:0">&nbsp;</td><td valign="middle" style="vertical-align:middle;border-left:2px solid #e2e8f0;padding:2px 0 2px 16px">${SIG_IMG}<p style="margin:2px 0 0;${F};font-size:14px;line-height:20px;color:#64748b"><strong style="color:#0f2c59">Head of Operations</strong><br>ImmoAdv</p><p style="margin:2px 0 8px;${F};font-size:13px;line-height:20px"><a href="${SITE}" style="color:#0284c7;text-decoration:none;font-weight:700">immoadv.de</a><br><a href="mailto:support@immoadv.de" style="color:#0284c7;text-decoration:none">support@immoadv.de</a></p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#0A66C2" style="background-color:#0a66c2;border-radius:6px"><a href="https://www.linkedin.com/company/immoadv/" style="display:inline-block;padding:6px 12px;${F};font-size:12px;font-weight:700;color:#ffffff;text-decoration:none"><span style="display:inline-block;background-color:#ffffff;color:#0a66c2;border-radius:3px;padding:0 4px;margin-right:6px;font-weight:800">in</span>ImmoAdv auf LinkedIn</a></td></tr></table></td></tr></table>`;

export function footer(unsubUrl: string | null): string {
  return `<tr><td class="ia-pad" bgcolor="#F8FAFC" style="background-color:#f8fafc;border-top:1px solid #eef2f6;border-radius:0 0 17px 17px;padding:10px 28px 12px;${F};font-size:10px;line-height:15px;color:#94a3b8">ImmoAdv · <a href="${SITE}/impressum" style="color:#94a3b8">Impressum</a> · <a href="${SITE}/datenschutz" style="color:#94a3b8">Datenschutz</a>${unsubUrl ? `<br>Sie möchten keine E-Mails mehr von uns? <a href="${esc(unsubUrl)}" style="color:#94a3b8;text-decoration:underline">Hier abmelden</a>` : ''}</td></tr>`;
}

// Zitierte Vorgängernachricht bei Antworten (als Text, damit fremdes HTML das Layout nicht stört).
export function quoteBlock(q: { from: string; date: string; text: string } | null): string {
  if (!q || !q.text) return '';
  const t = esc(q.text.slice(0, 6000)).replace(/\n/g, '<br>');
  return `<tr><td class="ia-pad" style="padding:0 28px 22px"><p style="margin:0 0 8px;${F};font-size:12px;line-height:18px;color:#64748b">Am ${esc(q.date)} schrieb ${esc(q.from)}:</p><div style="margin:0;padding:10px 14px;border-left:3px solid #cbd5e1;${F};font-size:13px;line-height:20px;color:#64748b">${t}</div></td></tr>`;
}

// Kompletter Brief (Inhalt aus dem Editor).
export function renderBrief(o: { body: string; greeting?: string; unsubUrl: string | null; quote?: { from: string; date: string; text: string } | null }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EEF2F7" style="background-color:#eef2f7"><tr><td class="ia-wrap" align="center" style="padding:26px 10px 34px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="max-width:600px;background-color:#ffffff;border-radius:18px;border:1px solid #e2e8f0;border-top:6px solid #0369a1">
${HEADER}
<tr><td class="ia-pad" style="padding:28px 28px 6px">${o.body}</td></tr>
<tr><td class="ia-pad" style="padding:10px 28px 28px"><p style="margin:0 0 14px;${F};font-size:16px;line-height:24px;color:#1e293b">${esc(o.greeting || 'Viele Grüße')}</p>${SIGNATURE}</td></tr>
${quoteBlock(o.quote ?? null)}
${footer(o.unsubUrl)}
</table></td></tr></table>`;
}

export function wrapDocument(subject: string, inner: string, preview: string): string {
  return `<!doctype html><html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no"><title>${esc(subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>table,td,p,a,h2,h3,li{font-family:Arial,sans-serif!important;mso-line-height-rule:exactly}</style><![endif]-->
<style>:root{color-scheme:light only;supported-color-schemes:light}body{margin:0!important;padding:0!important;width:100%!important}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}@media (max-width:480px){.ia-pad{padding-left:18px!important;padding-right:18px!important}.ia-wrap{padding:12px 6px 20px!important}}</style></head>
<body style="margin:0;padding:0;background-color:#eef2f7;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preview.replace(/\s+/g, ' ').slice(0, 140))}${'&#8199;&#65279;&#847;'.repeat(30)}</div>
<!--[if mso]><table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
${inner}
<!--[if mso]></td></tr></table><![endif]-->
</body></html>`;
}

export function fillTemplate(html: string, termin: string | null, fallback: string | null): string {
  const url = termin || fallback || 'mailto:support@immoadv.de?subject=Terminvorschlag';
  return html.split('{{TERMIN_URL}}').join(url.replace(/&/g, '&amp;').replace(/"/g, '&quot;'));
}
