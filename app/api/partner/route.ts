import { NextResponse } from 'next/server';
import { allowRequest } from '@/lib/security/rate-limit';
import { adminConfigured, anonymizedIpHash, supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[a-z0-9-]{3,40}$/;

// Öffentliche Angaben eines aktiven Co-Branding-Partners (nur Name und Art).
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug') ?? '';
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: 'Partner nicht gefunden.' }, { status: 404 });
  if (!allowRequest(`partner:${anonymizedIpHash(req) ?? 'x'}`, 60, 60_000)) return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 });
  if (!adminConfigured()) return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 503 });
  const { data } = await supabaseAdmin().from('immo_partners').select('slug, name, kind').eq('slug', slug).eq('active', true).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Partner nicht gefunden.' }, { status: 404 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
