import { createHash } from 'node:crypto';
import { panicState } from '@/lib/security/panic';

// Prüft das Supabase-Zugriffstoken serverseitig und liefert den angemeldeten Nutzer.
export type AuthUser = { id: string; email: string };

// Kurzzeit-Cache (30 s) je Token-Hash: spart bei mehreren Aufrufen hintereinander
// (Dashboard lädt Dokumente, Freigaben, Abrechnung) je einen Rundweg zu Supabase.
// Abgelehnte Tokens werden nicht zwischengespeichert.
const TTL_MS = 30_000;
const cache = new Map<string, { user: AuthUser; until: number }>();

function remember(key: string, user: AuthUser, now: number) {
  if (cache.size > 2000) {
    for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
    if (cache.size > 2000) cache.clear();
  }
  cache.set(key, { user, until: now + TTL_MS });
}

export async function userFromRequest(req: Request): Promise<AuthUser | null> {
  const user = await verifiedUser(req);
  if (!user) return null;
  // Not-Aus: nur Administratoren bleiben angemeldet.
  const panic = await panicState().catch(() => ({ active: false }));
  if (panic.active) {
    const admins = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!admins.includes(user.email)) return null;
  }
  return user;
}

async function verifiedUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ') || header.length < 20 || header.length > 4096) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const now = Date.now();
  const cacheKey = createHash('sha256').update(header).digest('hex');
  const hit = cache.get(cacheKey);
  if (hit && hit.until > now) return hit.user;

  let r: Response;
  try {
    r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: header },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return null;
  }
  if (!r.ok) {
    cache.delete(cacheKey);
    return null;
  }
  const u = (await r.json().catch(() => ({}))) as { id?: string; email?: string };
  if (!u.id || !u.email) return null;
  const user = { id: u.id, email: u.email.toLowerCase() };
  remember(cacheKey, user, now);
  return user;
}
