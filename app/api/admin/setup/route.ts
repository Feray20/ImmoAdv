import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/security/admin';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { adminAudit } from '@/lib/b2b/core';
import { fromAddress } from '@/lib/notify/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Web-Admin → Einrichtung: was noch fehlt, mit Anleitung. Automatisch geprüfte Punkte erkennen ihren Stand selbst;
// Punkte außerhalb von ImmoAdv (Supabase-Dashboard, Stripe-Dashboard, Anwalt …) hakt der Administrator ab.
const j = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const has = (k: string) => Boolean(process.env[k] && String(process.env[k]).trim());
const KEY = 'setup_manual';
const VERCEL = 'https://vercel.com/klk19/immoadv/settings/environment-variables';
const SB = 'https://supabase.com/dashboard/project/mieoylqhtvghcnvaxutg';
const a = (href: string, t: string) => `<a href="${href}" target="_blank" rel="noopener">${t}</a>`;

type Item = { id: string; group: string; title: string; why: string; steps: string[]; auto: boolean; ok: boolean | null; optional?: boolean; info?: string };

async function resendDomain(): Promise<boolean | null> {
  const key = process.env.RESEND_API_KEY; const from = fromAddress();
  const dom = (/@([^>\s]+)/.exec(from || '')?.[1] || '').toLowerCase();
  if (!key || !dom) return false;
  try {
    const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null; // Schlüssel nur mit Sende-Recht: Stand nicht lesbar
    const d = (await r.json()) as { data?: { name: string; status: string }[] };
    const hit = (d.data || []).find((x) => x.name.toLowerCase() === dom);
    return hit ? hit.status === 'verified' : false;
  } catch { return null; }
}

async function items(manual: Record<string, string>): Promise<Item[]> {
  const db = adminConfigured() ? supabaseAdmin() : null;
  const sk = String(process.env.STRIPE_SECRET_KEY || '');
  const live = sk.startsWith('sk_live') || sk.startsWith('rk_live');
  const dom = await resendDomain();
  const { data: qa } = db ? await db.from('immo_b2b_accounts').select('id').ilike('company_name', 'QA Testfirma%').limit(1) : { data: [] };
  const L: Item[] = [
    // ---------- E-Mail ----------
    { id: 'resend', group: 'E-Mail-Versand', title: 'Resend-Schlüssel und Absender in Vercel', auto: true, ok: has('RESEND_API_KEY') && Boolean(fromAddress()),
      why: 'Ohne Versand gehen keine Zugangsdaten, Rechnungen, Bestätigungs-Mails oder Neuigkeiten raus.',
      steps: [`${a('https://resend.com/api-keys', 'Resend → API Keys')} → „Create API Key“ (Sending access, Domain immoadv.de).`, `${a(VERCEL, 'Vercel → Environment Variables')}: <code>RESEND_API_KEY</code> und <code>NOTIFY_FROM_EMAIL</code> = <code>ImmoAdv &lt;noreply@immoadv.de&gt;</code> (Production), danach neu deployen.`] },
    { id: 'resend_domain', group: 'E-Mail-Versand', title: 'Domain immoadv.de bei Resend bestätigt', auto: dom !== null, ok: dom === null ? manual.resend_domain ? true : false : dom,
      info: dom === null ? 'Stand mit dem Sende-Schlüssel nicht lesbar – nach „Test 1“ im Reiter System selbst abhaken.' : undefined,
      why: 'Nur mit bestätigter Domain kommen E-Mails von noreply@immoadv.de an und landen nicht im Spam.',
      steps: [`${a('https://resend.com/domains', 'Resend → Domains')} → „Add Domain“ → <code>immoadv.de</code>, Region Frankfurt (eu-central-1).`, 'Hostinger → Domains → immoadv.de → DNS: die angezeigten Einträge (MX und TXT für „send“, TXT „resend._domainkey“) genau übernehmen; zusätzlich TXT <code>_dmarc</code> = <code>v=DMARC1; p=none;</code>.', 'Bei Resend „Verify DNS Records“ (dauert einige Minuten bis Stunden).', 'Web-Admin → System → „Test 1: ImmoAdv-E-Mail an mich“.'] },
    { id: 'smtp', group: 'E-Mail-Versand', title: 'Supabase sendet über eigenen Absender (SMTP)', auto: false, ok: Boolean(manual.smtp),
      why: 'Sonst kommen Registrierungs- und Passwort-Mails vom Absender „Supabase Auth“ und sind stark begrenzt (wenige Mails pro Stunde).',
      steps: [`${a(SB + '/auth/smtp', 'Supabase → Authentication → Emails → SMTP Settings')} → „Enable custom SMTP“.`, 'Sender email <code>noreply@immoadv.de</code>, Sender name <code>ImmoAdv</code>, Host <code>smtp.resend.com</code>, Port <code>465</code>, Username <code>resend</code>, Password = Ihr Resend-API-Schlüssel.', 'Web-Admin → System → „Test 2: Konto-E-Mail über Supabase an mich“ – kommt sie als „ImmoAdv“ an, hier abhaken.'] },
    { id: 'templates', group: 'E-Mail-Versand', title: 'ImmoAdv-Vorlagen für Konto-E-Mails in Supabase', auto: false, ok: Boolean(manual.templates),
      why: 'Bestätigungs- und Passwort-Mails im ImmoAdv-Design statt im englischen Standardtext.',
      steps: ['Web-Admin → System → Abschnitt „E-Mail-Versand“ → Vorlagen herunterladen.', `${a(SB + '/auth/templates', 'Supabase → Authentication → Emails → Templates')}: je Vorlage Betreff und HTML einfügen und speichern.`] },
    { id: 'urls', group: 'E-Mail-Versand', title: 'Supabase: Website-Adresse und erlaubte Rücksprung-Adressen', auto: false, ok: Boolean(manual.urls),
      why: 'Sonst führen Links in Bestätigungs- und Passwort-Mails ins Leere.',
      steps: [`${a(SB + '/auth/url-configuration', 'Supabase → Authentication → URL Configuration')}: Site URL <code>https://immoadv.de</code>.`, 'Redirect URLs hinzufügen: <code>https://immoadv.de/auth/login</code>, <code>https://immoadv.de/auth/reset</code>, <code>https://immoadv.de/auth/callback</code>, <code>https://immoadv.de/auth/confirm</code>, <code>https://immoadv.de/b2b-portal</code>, <code>https://partner.immoadv.de</code>.'] },
    { id: 'b2bnotify', group: 'E-Mail-Versand', title: 'Geschäftsadresse für B2B-Meldungen', auto: true, ok: has('B2B_NOTIFY_EMAIL'), optional: true,
      why: 'Kontoanfragen und Registrierungsnachweise gehen sonst an die Admin-Adresse.',
      steps: [`${a(VERCEL, 'Vercel')}: <code>B2B_NOTIFY_EMAIL</code> = Ihre Geschäftsadresse (Production), neu deployen.`] },
    // ---------- Zahlungen ----------
    { id: 'stripe_test', group: 'Zahlungen', title: 'Stripe-Testschlüssel für den Testkauf', auto: true, ok: has('STRIPE_TEST_SECRET_KEY'),
      why: 'Damit Sie im Web-Admin unter „Testkauf“ jeden Tarif ohne echtes Geld durchspielen können.',
      steps: [`${a('https://dashboard.stripe.com/test/apikeys', 'Stripe → Entwickler → API-Schlüssel (Testmodus)')} → Secret key neu erzeugen („Roll key“ – der alte wurde im Chat gezeigt).`, `${a(VERCEL, 'Vercel')}: <code>STRIPE_TEST_SECRET_KEY</code> = <code>sk_test_…</code> (Production), neu deployen.`, 'Den alten Eintrag <code>STRIPE_SECRET_KEY</code> (nur Preview) mit dem neuen Testschlüssel ersetzen oder löschen.'] },
    { id: 'stripe_brand', group: 'Zahlungen', title: 'Stripe: PayPal einschalten, Logo und Farben', auto: false, ok: Boolean(manual.stripe_brand),
      why: 'Bezahlseite, Rechnungen und Kundenportal erscheinen im ImmoAdv-Design und bieten PayPal an.',
      steps: [`${a('https://dashboard.stripe.com/settings/payment_methods', 'Stripe → Einstellungen → Zahlungsmethoden')}: PayPal, Apple Pay, Google Pay, Klarna, SEPA einschalten (Test- und Live-Modus).`, `${a('https://dashboard.stripe.com/settings/branding', 'Stripe → Einstellungen → Branding')}: Logo <code>/brand/immoadv-stripe-logo.png</code> und Symbol <code>/brand/immoadv-stripe-icon.png</code> hochladen, Markenfarbe <code>#0F2C59</code>, <strong>Akzent- bzw. Buttonfarbe <code>#000000</code></strong> (schwarz wie Apple Pay – so sieht der Bezahlknopf auf der Stripe-Seite aus wie auf ImmoAdv). Im Testmodus und im Live-Modus einstellen.`, `${a('https://dashboard.stripe.com/settings/billing/invoice', 'Stripe → Rechnungen')}: Rechnungsnummern-Präfix, Fußzeile mit Impressum und Steuernummer/USt-IdNr.`] },
    { id: 'invoice', group: 'Zahlungen', title: 'Bankverbindung für B2B-Rechnungen (Kauf auf Rechnung)', auto: true, ok: has('INVOICE_IBAN') && has('INVOICE_BIC'),
      why: 'Erscheint auf Rechnungen an Unternehmen, die per Überweisung zahlen.',
      steps: [`${a(VERCEL, 'Vercel')}: <code>INVOICE_IBAN</code>, <code>INVOICE_BIC</code>, <code>INVOICE_BANK_NAME</code> (Production), neu deployen.`] },
    { id: 'webhook', group: 'Zahlungen', title: 'Stripe-Webhook (Zahlungsbestätigungen)', auto: true, ok: has('STRIPE_WEBHOOK_SECRET'),
      why: 'Ohne Webhook werden B2B-Tarife nach der Zahlung nicht automatisch aktiviert und Käufe nicht gezählt.',
      steps: [`${a('https://dashboard.stripe.com/webhooks', 'Stripe → Entwickler → Webhooks')} → „Endpunkt hinzufügen“: <code>https://immoadv.de/api/stripe/webhook</code>.`, 'Ereignisse: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed.', `Signing secret kopieren → ${a(VERCEL, 'Vercel')}: <code>STRIPE_WEBHOOK_SECRET</code> (Production), neu deployen.`, 'Erst im Testmodus einrichten und mit dem Testkauf prüfen, später im Live-Modus wiederholen.'] },
    { id: 'golive', group: 'Zahlungen', title: 'Live-Zahlungen freischalten (Start mit echten Kunden)', auto: true, ok: live && process.env.BILLING_ENABLED === 'true',
      info: live ? 'Live-Schlüssel vorhanden' : sk ? 'nur Testschlüssel hinterlegt' : 'kein Schlüssel in Production',
      why: 'Erst danach können Kunden wirklich bezahlen. Vorher: Testkauf erfolgreich, Rechtstexte geprüft, Webhook live.',
      steps: ['Stripe-Konto vollständig verifizieren (Unternehmensdaten, Bankkonto, Ausweis).', `${a('https://dashboard.stripe.com/apikeys', 'Stripe → API-Schlüssel (Live)')}: Secret key → ${a(VERCEL, 'Vercel')}: <code>STRIPE_SECRET_KEY</code> = <code>sk_live_…</code> (nur Production).`, 'Webhook im Live-Modus anlegen und <code>STRIPE_WEBHOOK_SECRET</code> auf das Live-Secret setzen.', '<code>BILLING_ENABLED</code> = <code>true</code> für Production setzen, neu deployen.', 'Einen echten Kauf mit kleinem Betrag machen und erstatten.'] },
    // ---------- Sicherheit ----------
    { id: 'cron', group: 'Sicherheit & Betrieb', title: 'Täglicher Lauf (Aufräumen, Fristen-Erinnerungen, Steuer-Export)', auto: true, ok: has('CRON_SECRET'),
      why: 'Ohne CRON_SECRET läuft der tägliche Job nicht: keine Fristen-Erinnerungen, keine automatische Löschung alter Daten (Datenschutz!), kein Monatsexport.',
      steps: [`${a(VERCEL, 'Vercel')}: <code>CRON_SECRET</code> = ein langer Zufallswert (z. B. 40 Zeichen aus einem Passwort-Manager), Production, neu deployen. Vercel übergibt ihn automatisch an den Lauf.`] },
    { id: 'rotate', group: 'Sicherheit & Betrieb', title: 'Im Chat gezeigte Schlüssel austauschen', auto: false, ok: Boolean(manual.rotate),
      why: 'Schlüssel, die einmal sichtbar waren, gelten als kompromittiert.',
      steps: [`${a(SB + '/settings/api-keys', 'Supabase → Settings → API Keys')}: Secret key (sb_secret_…) neu erzeugen → in ${a(VERCEL, 'Vercel')} <code>SUPABASE_SERVICE_ROLE_KEY</code> ersetzen → neu deployen → alten Schlüssel löschen.`, 'Stripe-Testschlüssel rollen (siehe Punkt „Stripe-Testschlüssel“).', 'BANKSapi-Zugang „immoadv-test“ beim Anbieter ändern bzw. löschen, falls nicht mehr gebraucht.', 'Das Passwort ändern, das auf einem Screenshot zu sehen war.'] },
    { id: 'preview_key', group: 'Sicherheit & Betrieb', title: 'Alte Variable SITE_PREVIEW_KEY löschen', auto: true, ok: !has('SITE_PREVIEW_KEY'),
      why: 'Die Vorschau-Sperre gibt es nicht mehr; der Eintrag ist überflüssig.',
      steps: [`${a(VERCEL, 'Vercel → Environment Variables')} → <code>SITE_PREVIEW_KEY</code> → „Remove“.`] },
    { id: 'pwned', group: 'Sicherheit & Betrieb', title: 'Schutz vor bekannten (geleakten) Passwörtern', auto: false, ok: Boolean(manual.pwned), optional: true,
      why: 'Verhindert, dass Kunden Passwörter aus Datenlecks verwenden.',
      steps: [`${a(SB + '/auth/providers?provider=Email', 'Supabase → Authentication → Providers → Email')}: „Prevent use of leaked passwords“ einschalten (je nach Supabase-Tarif verfügbar), Mindestlänge 10.`] },
    { id: 'qa', group: 'Sicherheit & Betrieb', title: 'Testkonto „QA Testfirma (temporär)“ entfernen', auto: true, ok: !(qa && qa.length),
      why: 'Das Testkonto blockiert Ihre Gmail-Adresse für ein echtes Unternehmenskonto.',
      steps: ['Sagen Sie mir im Chat „Testfirma löschen“ – ich entferne den Eintrag sauber aus der Datenbank.'] },
    // ---------- Recht & Sichtbarkeit ----------
    { id: 'legal', group: 'Recht & Sichtbarkeit', title: 'Rechtstexte prüfen lassen', auto: false, ok: Boolean(manual.legal),
      why: 'Impressum, Datenschutz, Nutzungsbedingungen, Widerruf, AVV und Preise sollten vor dem Start mit zahlenden Kunden fachlich geprüft sein.',
      steps: ['Rechtstexte-Dienst (z. B. IT-Recht Kanzlei, Händlerbund) oder Anwalt für IT-/Wettbewerbsrecht beauftragen.', 'Prüfen lassen: /impressum, /datenschutz (inkl. 7 Reichweitenmessung, 8e/8f Berater und Werbung), /nutzungsbedingungen (inkl. 13 Unternehmen), AVV im B2B-Portal.', 'Änderungen schicken Sie mir – ich übernehme sie.'] },
    { id: 'impressum', group: 'Recht & Sichtbarkeit', title: 'Telefonnummer und Angaben im Impressum', auto: false, ok: Boolean(manual.impressum),
      why: 'Das Impressum braucht einen schnellen, direkten Kontaktweg; je nach Rechtsform auch USt-IdNr. bzw. Registerangaben.',
      steps: ['Schicken Sie mir Telefonnummer (oder schnelles Kontaktformular), ggf. USt-IdNr. und Rechtsform – ich trage sie ein.'] },
    { id: 'gsc', group: 'Recht & Sichtbarkeit', title: 'Google Search Console einrichten', auto: false, ok: Boolean(manual.gsc),
      why: 'Damit Google die Seiten schneller findet und Sie sehen, mit welchen Suchbegriffen Besucher kommen.',
      steps: [`${a('https://search.google.com/search-console', 'Google Search Console')} → „Property hinzufügen“ → Domain <code>immoadv.de</code>.`, 'Den angezeigten TXT-Eintrag bei Hostinger → DNS anlegen, dann „Bestätigen“.', 'Unter „Sitemaps“ <code>https://immoadv.de/sitemap.xml</code> einreichen.'] },
    { id: 'testrun', group: 'Recht & Sichtbarkeit', title: 'Einmal alles selbst durchspielen', auto: false, ok: Boolean(manual.testrun),
      why: 'Echte Daten zeigen Fehler, die Tests mit Beispielwerten nicht finden.',
      steps: ['Privatkonto anlegen (Partner → „+ Privatkonto“) und mit dem Startpasswort anmelden.', 'Unternehmen anlegen (Partner → „+ Unternehmen“), im Portal anmelden, Branche wählen, Fall-Analyse mit echten PDFs.', 'Kontoanfrage auf /b2b mit Nachweis senden und im Web-Admin öffnen.', 'Testkauf (sobald der Testschlüssel hinterlegt ist).'] },
  ];
  return L;
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!adminConfigured()) return j({ error: 'Nicht konfiguriert.' }, 503);
  const { data } = await supabaseAdmin().from('immo_settings').select('value').eq('key', KEY).maybeSingle();
  const manual = (data?.value as Record<string, string>) || {};
  const list = await items(manual);
  return j({ items: list.map((x) => ({ ...x, doneAt: manual[x.id] || null })), env: process.env.VERCEL_ENV || 'lokal' });
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!adminConfigured()) return j({ error: 'Nicht konfiguriert.' }, 503);
  const p = z.object({ id: z.string().regex(/^[a-z_]{2,30}$/), done: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return j({ error: 'Ungültig.' }, 400);
  const db = supabaseAdmin();
  const { data } = await db.from('immo_settings').select('value').eq('key', KEY).maybeSingle();
  const v = { ...((data?.value as Record<string, string>) || {}) };
  if (p.data.done) v[p.data.id] = new Date().toISOString(); else delete v[p.data.id];
  const r = await db.from('immo_settings').upsert({ key: KEY, value: v, updated_at: new Date().toISOString(), updated_by: auth.user.email });
  if (r.error) return j({ error: 'Speichern fehlgeschlagen.' }, 500);
  await adminAudit(auth.user.email, 'setup_mark', p.data.id, { done: p.data.done });
  return j({ ok: true });
}
