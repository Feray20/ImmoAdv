import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
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
  // Fällige, unbezahlte Rechnungen als überfällig markieren; abgelaufene Einladungen entfernen.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  const db = supabaseAdmin();
  const overdue = await db.from('immo_invoices').update({ payment_status: 'OVERDUE' }).eq('payment_status', 'PENDING').lt('due_date', today).select('id').then((r) => r.data?.length ?? 0, () => -1);
  await db.from('immo_b2b_invites').delete().lt('expires_at', new Date(Date.now() - 30 * 864e5).toISOString()).then(() => null, () => null);
  return NextResponse.json({ ok: true, cleanup, reminders, overdue }, { headers: { 'Cache-Control': 'no-store' } });
}
