// Optionaler E-Mail-Versand über Resend. Ohne RESEND_API_KEY und NOTIFY_FROM_EMAIL (bzw. CANCEL_FROM_EMAIL) wird nichts versendet.
const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const html = (t: string) => t.replace(/[&<>"]/g, (c) => ENT[c] ?? c);

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && (process.env.NOTIFY_FROM_EMAIL || process.env.CANCEL_FROM_EMAIL));
}

export type Attachment = { filename: string; content: Uint8Array | Buffer };

export async function sendMail(to: string, subject: string, text: string, attachments: Attachment[] = []): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL || process.env.CANCEL_FROM_EMAIL;
  if (!key || !from) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [to], subject, text, html: `<pre style="font-family:Helvetica,Arial,sans-serif;white-space:pre-wrap">${html(text)}</pre>`,
        ...(attachments.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64') })) } : {}),
      }),
      signal: AbortSignal.timeout(attachments.length ? 30000 : 8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
