import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';

// Not-Aus: Solange aktiv, weisen alle angemeldeten Schnittstellen Nicht-Administratoren ab (Sitzungen wirken wie beendet),
// Partnerseiten, Widget und Anfragen sind abgeschaltet. Gespeichert in immo_settings, 15 s zwischengespeichert.
export type Panic = { active: boolean; since?: string; by?: string; reason?: string };

let cache: { v: Panic; until: number } | null = null;

export async function panicState(): Promise<Panic> {
  const now = Date.now();
  if (cache && cache.until > now) return cache.v;
  let v: Panic = { active: false };
  if (adminConfigured()) {
    const { data } = await supabaseAdmin().from('immo_settings').select('value').eq('key', 'panic').maybeSingle();
    if (data?.value && typeof data.value === 'object') v = data.value as Panic;
  }
  cache = { v, until: now + 15_000 };
  return v;
}

export async function setPanic(active: boolean, by: string, reason = ''): Promise<void> {
  const value: Panic = active ? { active: true, since: new Date().toISOString(), by, reason } : { active: false };
  await supabaseAdmin().from('immo_settings').upsert({ key: 'panic', value, updated_at: new Date().toISOString(), updated_by: by });
  cache = { v: value, until: Date.now() + 15_000 };
}

// IPv4-Freigabeliste für den Admin-Bereich (ADMIN_IP_ALLOWLIST, kommagetrennt, einzelne Adressen oder CIDR, IPv6 nur exakt).
export function ipAllowed(req: Request): boolean {
  const list = (process.env.ADMIN_IP_ALLOWLIST || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) return true;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  if (!ip) return false;
  const toNum = (a: string) => a.split('.').reduce((n, o) => (n << 8) + (Number(o) & 255), 0) >>> 0;
  return list.some((entry) => {
    if (!entry.includes('/')) return entry === ip;
    const [base, bits] = entry.split('/');
    if (ip.includes(':') || base.includes(':')) return false;
    const b = Number(bits);
    if (!(b >= 0 && b <= 32)) return false;
    const mask = b === 0 ? 0 : (~0 << (32 - b)) >>> 0;
    return (toNum(ip) & mask) === (toNum(base) & mask);
  });
}
