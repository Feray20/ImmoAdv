import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, adminList, mfaRequired } from '@/lib/security/admin';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { mailConfigured, sendMail } from '@/lib/notify/mail';
import { billingEnabled } from '@/lib/billing/stripe';
import { panicState } from '@/lib/security/panic';
import { adminAudit } from '@/lib/b2b/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const j = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const has = (k: string) => Boolean(process.env[k] && String(process.env[k]).trim());

// Systemstatus für den Inhaber: welche Dienste eingerichtet sind (nur ja/nein – niemals Werte von Schlüsseln).
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const q = new URL(req.url).searchParams;

  // Nutzer-Suche (datensparsam): nur Kennzahlen, keine Inhalte.
  const email = (q.get('user') || '').trim().toLowerCase();
  if (email) {
    if (!adminConfigured()) return j({ error: 'Nicht konfiguriert.' }, 503);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return j({ error: 'Bitte eine E-Mail-Adresse eingeben.' }, 400);
    const db = supabaseAdmin();
    const { data: row } = await db.from('immo_user_data').select('user_id, profile, objects, updated_at').eq('email', email).maybeSingle();
    if (!row) return j({ found: false });
    const u = (await db.auth.admin.getUserById(row.user_id)).data?.user;
    const [{ count: docs }, { count: maps }, { data: mem }] = await Promise.all([
      db.from('immo_documents').select('id', { count: 'exact', head: true }).eq('owner_id', row.user_id),
      db.from('immo_kreditmappe_versions').select('id', { count: 'exact', head: true }).eq('owner_id', row.user_id),
      db.from('immo_b2b_members').select('role, account_id').eq('user_id', row.user_id).limit(1),
    ]);
    await adminAudit(auth.user.email, 'user_lookup', row.user_id, {});
    const prof = (row.profile || {}) as { mode?: string; phase?: number };
    return j({
      found: true,
      user: {
        id: row.user_id, createdAt: u?.created_at ?? null, lastSignIn: u?.last_sign_in_at ?? null, confirmed: Boolean(u?.email_confirmed_at),
        mfa: (u?.factors ?? []).some((f) => f.status === 'verified'), mode: prof.mode ?? null, phase: Number.isInteger(prof.phase) ? prof.phase : null,
        objects: Array.isArray(row.objects) ? row.objects.length : 0, documents: docs ?? 0, kreditmappen: maps ?? 0,
        b2b: mem?.[0] ? { role: mem[0].role, accountId: mem[0].account_id } : null, updatedAt: row.updated_at,
      },
    });
  }

  let db_ok = false;
  if (adminConfigured()) {
    try { const r = await supabaseAdmin().from('immo_settings').select('key').limit(1); db_ok = !r.error; } catch { db_ok = false; }
  }
  const panic = await panicState().catch(() => ({ active: false }));
  const checks = [
    { key: 'db', label: 'Datenbank (Supabase)', ok: db_ok, fix: 'SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in Vercel setzen.' },
    { key: 'admins', label: 'Administratoren (ADMIN_EMAILS)', ok: adminList().length > 0, info: `${adminList().length} eingetragen`, fix: 'ADMIN_EMAILS setzen (kommagetrennt).' },
    { key: 'mfa', label: 'Zweiter Faktor für Admins', ok: mfaRequired(), fix: 'ADMIN_MFA nicht auf „off“ setzen; in Supabase TOTP aktivieren.' },
    { key: 'mail', label: 'E-Mail-Versand (Resend)', ok: mailConfigured(), fix: 'RESEND_API_KEY und NOTIFY_FROM_EMAIL setzen, Absender-Domain bei Resend verifizieren.' },
    { key: 'cron', label: 'Täglicher Lauf (CRON_SECRET)', ok: has('CRON_SECRET'), fix: 'CRON_SECRET setzen (zufälliger langer Wert).' },
    { key: 'billing', label: 'Zahlungen (Stripe)', ok: billingEnabled(), info: has('STRIPE_SECRET_KEY') ? (String(process.env.STRIPE_SECRET_KEY).startsWith('sk_live') ? 'Live-Schlüssel' : 'Test-Schlüssel') : 'kein Schlüssel', fix: 'BILLING_ENABLED, STRIPE_SECRET_KEY (live) und STRIPE_WEBHOOK_SECRET setzen.' },
    { key: 'webhook', label: 'Stripe-Webhook', ok: has('STRIPE_WEBHOOK_SECRET'), fix: 'Webhook in Stripe anlegen und STRIPE_WEBHOOK_SECRET setzen.' },
    { key: 'invoice', label: 'Bankverbindung auf Rechnungen', ok: has('INVOICE_IBAN') && has('INVOICE_BIC'), fix: 'INVOICE_IBAN, INVOICE_BIC, INVOICE_BANK_NAME setzen.' },
    { key: 'b2bmail', label: 'Geschäfts-E-Mail für B2B-Registrierungsnachweise', ok: has('B2B_NOTIFY_EMAIL'), info: has('B2B_NOTIFY_EMAIL') ? 'eingetragen' : 'Nachweise gehen an ADMIN_EMAILS', optional: true, fix: 'B2B_NOTIFY_EMAIL mit Ihrer Geschäftsadresse setzen.' },
    { key: 'tax', label: 'Steuerkanzlei (monatlicher Export)', ok: has('TAX_ADVISOR_EMAIL'), fix: 'TAX_ADVISOR_EMAIL setzen.' },
    { key: 'leadtoken', label: 'Eigener Schlüssel für Anfrage-PDFs', ok: has('LEAD_TOKEN_SECRET'), optional: true, fix: 'Optional: LEAD_TOKEN_SECRET setzen.' },
    { key: 'ip', label: 'IP-Freigabe für Admin', ok: has('ADMIN_IP_ALLOWLIST'), optional: true, fix: 'Optional: ADMIN_IP_ALLOWLIST setzen.' },
    { key: 'preview', label: 'Vorschau-Sperre (Coming soon)', ok: !has('SITE_PREVIEW_KEY'), info: has('SITE_PREVIEW_KEY') ? `aktiv${has('SITE_PREVIEW_PASSWORD') ? ', mit Passwort' : ', nur Zugangslink'}` : 'Website öffentlich', optional: true, fix: 'Zum Start SITE_PREVIEW_KEY löschen.' },
    { key: 'panic', label: 'Not-Aus', ok: !panic.active, info: panic.active ? 'AKTIV' : 'aus', fix: 'Im Reiter „Sicherheit“ ausschalten.' },
  ];
  return j({ checks, env: process.env.VERCEL_ENV || 'lokal', commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7), region: process.env.VERCEL_REGION || null });
}

// Test-E-Mail an die eigene Admin-Adresse.
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const p = z.object({ action: z.literal('testmail') }).safeParse(await req.json().catch(() => null));
  if (!p.success) return j({ error: 'Ungültig.' }, 400);
  if (!mailConfigured()) return j({ error: 'E-Mail-Versand ist nicht eingerichtet (RESEND_API_KEY, NOTIFY_FROM_EMAIL).' }, 503);
  const ok = await sendMail(auth.user.email, 'ImmoAdv: Test-E-Mail', `Diese Test-E-Mail bestätigt, dass der E-Mail-Versand funktioniert.\nZeitpunkt: ${new Date().toISOString()}`);
  await adminAudit(auth.user.email, 'testmail', null, { ok });
  return ok ? j({ ok: true, to: auth.user.email }) : j({ error: 'Versand fehlgeschlagen – Absender-Domain bei Resend verifiziert?' }, 502);
}
