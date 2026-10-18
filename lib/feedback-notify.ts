import { sendMail, mailConfigured } from '@/lib/notify/mail';
import { TOPICS } from '@/lib/feedback';

// Kurze Benachrichtigung an die Betreiberin (ADMIN_EMAILS, erste Adresse) – ohne Inhalt des Vorschlags.
export async function notifyAdmin(area: 'b2c' | 'b2b', topic: keyof typeof TOPICS, importance: number): Promise<void> {
  const to = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim()).filter(Boolean)[0];
  if (!to || !mailConfigured()) return;
  await sendMail(to, `Neuer Verbesserungsvorschlag (${area.toUpperCase()})`, `Ein neuer Verbesserungsvorschlag ist eingegangen.\n\nBereich: ${area === 'b2b' ? 'Unternehmen (B2B)' : 'Privatkunden (B2C)'}\nThema: ${TOPICS[topic]}\nWichtigkeit für den Kunden: ${importance} von 5`, [], {
    title: 'Neuer Verbesserungsvorschlag', button: { label: 'Im Web-Admin ansehen', url: 'https://immoadv.de/intern/web-admin#vorschlaege' },
  });
}
