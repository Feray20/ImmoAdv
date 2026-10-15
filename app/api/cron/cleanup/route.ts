import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminConfigured } from '@/lib/supabase/admin';
import { cleanupAllIncoming } from '@/lib/documents/cleanup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Täglicher Aufräumlauf (Vercel Cron). Vercel sendet "Authorization: Bearer $CRON_SECRET".
// Ohne gesetztes CRON_SECRET bleibt die Route gesperrt.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get('authorization') || '';
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!adminConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const r = await cleanupAllIncoming();
  console.log('cron_cleanup', r);
  return NextResponse.json({ ok: true, ...r }, { headers: { 'Cache-Control': 'no-store' } });
}
