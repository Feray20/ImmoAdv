import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { cleanupAllIncoming } from '@/lib/documents/cleanup';
import { runReminders } from '@/lib/reminders/run';
import { generateMonthlyTaxArchive, nthWorkday } from '@/lib/b2b/taxarchive';
import { mailConfigured, sendMail } from '@/lib/notify/mail';
import { cleanupExports } from '@/lib/storage/exports';

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
  const exportsRemoved = await cleanupExports().catch(() => -1);
  const retention = await leadRetention().catch((e) => ({ error: String(e instanceof Error ? e.message : e) }));
  const tax = await taxDispatch(today).catch((e) => ({ error: String(e instanceof Error ? e.message : e) }));
  return NextResponse.json({ ok: true, cleanup, reminders, overdue, retention, exportsRemoved, tax }, { headers: { 'Cache-Control': 'no-store' } });
}

// Monatsarchiv des Vormonats am n-ten Werktag (TAX_DISPATCH_WORKDAY, Standard 3) an TAX_ADVISOR_EMAIL senden. Einmal je Monat.
async function taxDispatch(today: string): Promise<Record<string, unknown>> {
  const to = process.env.TAX_ADVISOR_EMAIL;
  if (!to || !mailConfigured()) return { skipped: 'nicht eingerichtet' };
  const [y, m] = today.split('-').map(Number);
  const n = Math.min(10, Math.max(1, Number(process.env.TAX_DISPATCH_WORKDAY || 3)));
  if (nthWorkday(y, m, n) !== today) return { skipped: 'nicht fällig' };
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const db = supabaseAdmin();
  const { data: done } = await db.from('immo_admin_audit').select('id').eq('action', 'tax_dispatch').eq('target', prev).limit(1);
  if (done?.length) return { skipped: 'bereits versendet', monat: prev };
  const skr = process.env.TAX_SKR === 'SKR04' ? 'SKR04' : 'SKR03';
  const a = await generateMonthlyTaxArchive(prev, skr);
  if (a.zip.length > 35 * 1024 * 1024) return { error: 'Archiv größer als 35 MB, bitte manuell herunterladen.', monat: prev };
  const ok = await sendMail(to, `ImmoAdv: Buchhaltungsunterlagen ${prev}`,
    `Guten Tag,\n\nanbei das Monatsarchiv ${prev} (${skr}) von ImmoAdv, Inh. Feray Korkmaz, USt-IdNr. DE348036700:\n` +
    `- Ausgangsrechnungen und Korrekturen als PDF (${a.count} Belege)\n- DATEV_Buchungsstapel.csv\n- Monatsjournal_Umsatzsteuer.csv\n` +
    (a.problems.length ? `\nHinweise (siehe LIESMICH.txt):\n- ${a.problems.join('\n- ')}\n` : '') +
    '\nDiese E-Mail wurde automatisch erstellt.', [{ filename: `ImmoAdv_Steuerexport_${prev}.zip`, content: a.zip }]);
  await db.from('immo_admin_audit').insert({ actor_email: 'cron', action: ok ? 'tax_dispatch' : 'tax_dispatch_failed', target: prev, meta: { to, count: a.count, problems: a.problems.length } });
  return { sent: ok, monat: prev, count: a.count };
}

// Speicherbegrenzung (Art. 5 Abs. 1 lit. e DSGVO): Anfragen nach der vom Unternehmen gewählten Frist löschen (Standard 24 Monate).
async function leadRetention(): Promise<Record<string, number>> {
  const db = supabaseAdmin();
  const { data: accs } = await db.from('immo_b2b_accounts').select('id, lead_retention_months').limit(5000);
  let deleted = 0;
  for (const a of accs ?? []) {
    const cutoff = new Date(Date.now() - (a.lead_retention_months || 24) * 30.44 * 864e5).toISOString();
    const r = await db.from('immo_b2b_leads').delete().eq('account_id', a.id).lt('created_at', cutoff).select('id');
    deleted += r.data?.length ?? 0;
  }
  await db.from('immo_security_log').delete().lt('created_at', new Date(Date.now() - 30 * 864e5).toISOString());
  await db.from('immo_webhook_log').delete().lt('created_at', new Date(Date.now() - 90 * 864e5).toISOString());
  return { deleted };
}
