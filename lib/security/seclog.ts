import { createHash } from 'node:crypto';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';

// Sicherheitsprotokoll: gedrosselte Zugriffe und abgewiesene Admin-Zugriffe. Gespeichert wird nur der Bereich
// und ein gekürzter Hash des Schlüssels (keine IP-Adresse, keine Nutzer-ID im Klartext); Löschung nach 30 Tagen.
export type SecKind = 'rate_limit' | 'admin_denied' | 'admin_ip_blocked' | 'admin_mfa_missing' | 'panic';

export function logSecurity(kind: SecKind, key: string): void {
  if (!adminConfigured()) return;
  const [bucket] = key.split(':');
  const subject = createHash('sha256').update(`seclog:${key}`).digest('hex').slice(0, 12);
  supabaseAdmin().from('immo_security_log').insert({ kind, bucket: bucket.slice(0, 40), subject }).then(() => null, () => null);
}
