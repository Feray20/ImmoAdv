import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminConfigured } from '@/lib/supabase/admin';
import { cleanupAllIncoming } from '@/lib/documents/cleanup';
import { runReminders } from '@/lib/reminders/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Täglicher Lauf (Vercel Cron): abgebrochene Uploads aufräumen, Fristen-Erinnerungen versenden. Vercel sendet "Authorization: Bearer $CRON_SECRET".
// Ohne gesetztes CRON_SECRET bleibt die Route gesperrt.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get('authorization') || '';
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!adminConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const cleanup = await cleanupAllIncoming().catch((e) => ({ error: String(e instanceof Error ? e.message : e) }));
  const origin = process.env.PUBLIC_SITE_URL || 'https://immoadv.de';
  const reminders = await runReminders(origin).catch((e) => ({ error: String(e instanceof Error ? e.message : e) }));
  console.log('cron_daily', { cleanup, reminders });
  return NextResponse.json({ ok: true, cleanup, reminders }, { headers: { 'Cache-Control': 'no-store' } });
}
