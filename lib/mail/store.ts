import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Postfach: Verläufe (Threads), Kontakt-Zuordnung, Vorschauzeile.
export const normSubject = (s: string) => String(s || '').replace(/^\s*((re|aw|antw|wg|fw|fwd|wtr)\s*(\[\d+\])?\s*:\s*)+/i, '').trim().toLowerCase();
export const snippetOf = (text: string) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 220);
const ids = (s: string | null | undefined) => (String(s || '').match(/<[^<>\s]+>/g) || []).slice(-30);

// Verlauf finden: zuerst über In-Reply-To/References, sonst gleicher Betreff mit gleicher Gegenstelle (90 Tage).
export async function findThread(o: { inReplyTo?: string | null; refs?: string | null; subject: string; counterpart: string }): Promise<string> {
  const db = supabaseAdmin();
  const cand = [...ids(o.inReplyTo), ...ids(o.refs)];
  if (cand.length) {
    const { data } = await db.from('immo_mail_messages').select('thread_id').in('message_id', cand).limit(1);
    if (data?.[0]) return data[0].thread_id as string;
  }
  const ns = normSubject(o.subject);
  if (ns && o.counterpart) {
    const since = new Date(Date.now() - 90 * 864e5).toISOString();
    const { data } = await db.from('immo_mail_messages').select('thread_id, subject, from_email, to_emails').gte('created_at', since).or(`from_email.eq.${o.counterpart},to_emails.cs.{${o.counterpart}}`).order('created_at', { ascending: false }).limit(50);
    const hit = (data ?? []).find((m) => normSubject(m.subject as string) === ns);
    if (hit) return hit.thread_id as string;
  }
  return randomUUID();
}

export async function contactFor(email: string): Promise<string | null> {
  if (!email) return null;
  const { data } = await supabaseAdmin().from('immo_crm_contacts').select('id').ilike('email', email).limit(1);
  return (data?.[0]?.id as string) ?? null;
}
