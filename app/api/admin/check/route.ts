import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/billing/auth';
import { allowRequest } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Interner Bereich: Freigabe nur für E-Mail-Adressen in ADMIN_EMAILS (kommagetrennt, in Vercel gesetzt).
// Ohne gesetzte Variable ist der Bereich für niemanden freigegeben.
export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ admin: false, reason: 'login' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  if (!allowRequest(`admin-check:${user.id}`, 30, 60_000)) return NextResponse.json({ admin: false }, { status: 429 });
  const list = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const admin = list.length > 0 && list.includes(user.email.toLowerCase());
  return NextResponse.json({ admin, configured: list.length > 0 }, { status: admin ? 200 : 403, headers: { 'Cache-Control': 'no-store' } });
}
