// Prüft das Supabase-Zugriffstoken serverseitig und liefert den angemeldeten Nutzer.
export type AuthUser = { id: string; email: string };

export async function userFromRequest(req: Request): Promise<AuthUser | null> {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: header },
    cache: 'no-store',
  });
  if (!r.ok) return null;
  const u = (await r.json()) as { id?: string; email?: string };
  if (!u.id || !u.email) return null;
  return { id: u.id, email: u.email.toLowerCase() };
}
