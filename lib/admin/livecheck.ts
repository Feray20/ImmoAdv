import '@/lib/env-alias';
import { stripe } from '@/lib/billing/stripe';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { fromAddress } from '@/lib/notify/mail';
import { pushConfigured } from '@/lib/security/push';

// Live-Prüfung der Einrichtung (Web-Admin → Einrichtung): fragt Stripe, Resend und die Datenbank direkt ab,
// statt nur Umgebungsvariablen zu prüfen. Liefert je Prüfung ok/warn/fail mit Erklärung.
export type Check = { id: string; label: string; state: 'ok' | 'warn' | 'fail'; info: string };
const NEED_EVENTS = ['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid'];

export async function webhookSelfTest(origin: string, type = 'checkout.session.completed'): Promise<Check> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { id: 'wh_self', label: 'Webhook-Selbsttest', state: 'fail', info: 'STRIPE_WEBHOOK_SECRET fehlt – Zahlungsbestätigungen können nicht geprüft werden.' };
  // Fiktives Ereignis, als Test markiert: wird signiert und verarbeitet, schaltet aber nichts frei und zählt nicht als Kauf.
  const payload = JSON.stringify({
    id: `evt_selftest_${Date.now()}`, object: 'event', type, api_version: null, created: Math.floor(Date.now() / 1000), livemode: false, pending_webhooks: 0, request: null,
    data: { object: { id: `cs_selftest_${Date.now()}`, object: 'checkout.session', payment_status: 'paid', status: 'complete', metadata: { immoadv_test: '1', plan: 'selftest' }, subscription: null } },
  });
  const header = stripe().webhooks.generateTestHeaderString({ payload, secret });
  const t0 = Date.now();
  try {
    const r = await fetch(`${origin}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': header }, body: payload, signal: AbortSignal.timeout(10000) });
    const ms = Date.now() - t0;
    if (r.ok) return { id: 'wh_self', label: 'Webhook-Selbsttest', state: 'ok', info: `Test-Ereignis „${type}“ signiert zugestellt und verarbeitet (HTTP ${r.status}, ${ms} ms).` };
    const body = await r.text().catch(() => '');
    return { id: 'wh_self', label: 'Webhook-Selbsttest', state: 'fail', info: `Abgewiesen mit HTTP ${r.status}${/signature/.test(body) ? ' – Signatur passt nicht: STRIPE_WEBHOOK_SECRET entspricht nicht dem Geheimnis des Endpunkts.' : ''}.` };
  } catch (e) {
    return { id: 'wh_self', label: 'Webhook-Selbsttest', state: 'fail', info: `Nicht erreichbar: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}` };
  }
}

export async function liveChecks(origin: string): Promise<Check[]> {
  const out: Check[] = [];
  const sk = String(process.env.STRIPE_SECRET_KEY || '');
  // Stripe-Schlüssel und Zahlarten
  if (!sk) out.push({ id: 'stripe_key', label: 'Stripe-Schlüssel', state: 'fail', info: 'STRIPE_SECRET_KEY fehlt.' });
  else {
    const live = /^(sk|rk)_live/.test(sk);
    try {
      const cfgs = await stripe().paymentMethodConfigurations.list({ limit: 20 });
      const def = cfgs.data.find((c) => c.is_default && c.active && !c.application) || cfgs.data.find((c) => c.is_default && c.active);
      const card = Boolean((def as unknown as { card?: { available?: boolean } })?.card?.available);
      out.push({ id: 'stripe_key', label: 'Stripe-Schlüssel', state: live ? 'ok' : 'warn', info: live ? 'Live-Schlüssel gültig – echte Zahlungen möglich.' : 'Test-Schlüssel aktiv – es fließt kein echtes Geld.' });
      out.push({ id: 'stripe_pm', label: 'Zahlarten', state: card ? 'ok' : 'fail', info: card ? 'Kartenzahlung freigeschaltet.' : 'Keine Kartenzahlung verfügbar – Stripe-Konto prüfen (Einstellungen → Zahlungsmethoden).' });
    } catch (e) {
      out.push({ id: 'stripe_key', label: 'Stripe-Schlüssel', state: 'fail', info: `Stripe lehnt den Schlüssel ab: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}` });
    }
    // Webhook-Endpunkt bei Stripe registriert, aktiv und mit den nötigen Ereignissen
    try {
      const eps = await stripe().webhookEndpoints.list({ limit: 50 });
      const ep = eps.data.find((e) => /\/api\/stripe\/webhook$/.test(e.url) && /immoadv\.de/.test(e.url)) || eps.data.find((e) => /\/api\/stripe\/webhook$/.test(e.url));
      if (!ep) out.push({ id: 'wh_reg', label: 'Webhook bei Stripe', state: 'fail', info: 'Kein Endpunkt …/api/stripe/webhook bei Stripe registriert.' });
      else {
        const miss = ep.enabled_events.includes('*') ? [] : NEED_EVENTS.filter((x) => !ep.enabled_events.includes(x));
        out.push({ id: 'wh_reg', label: 'Webhook bei Stripe', state: ep.status !== 'enabled' ? 'fail' : miss.length ? 'warn' : 'ok', info: `${ep.url} · ${ep.status === 'enabled' ? 'aktiv' : 'deaktiviert'}${miss.length ? ` · fehlende Ereignisse: ${miss.join(', ')}` : ' · alle nötigen Ereignisse'}` });
      }
    } catch { out.push({ id: 'wh_reg', label: 'Webhook bei Stripe', state: 'warn', info: 'Webhook-Liste nicht lesbar (eingeschränkter Schlüssel?).' }); }
  }
  out.push(await webhookSelfTest(origin));
  // E-Mail: Resend-Domain verifiziert
  const key = process.env.RESEND_API_KEY, from = fromAddress(), dom = (/@([^>\s]+)/.exec(from || '')?.[1] || '').toLowerCase();
  if (!key || !dom) out.push({ id: 'mail', label: 'E-Mail-Absender', state: 'fail', info: 'RESEND_API_KEY oder Absender (NOTIFY_FROM_EMAIL) fehlt.' });
  else {
    try {
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
      if (!r.ok) out.push({ id: 'mail', label: 'E-Mail-Absender', state: 'warn', info: `Schlüssel darf Domains nicht lesen (nur Senden). Absender ${dom} – bitte Testmail im Reiter System senden.` });
      else {
        const d = (await r.json()) as { data?: { name: string; status: string }[] };
        const hit = (d.data || []).find((x) => x.name.toLowerCase() === dom);
        out.push({ id: 'mail', label: 'E-Mail-Absender', state: hit?.status === 'verified' ? 'ok' : 'fail', info: hit ? `Domain ${dom}: ${hit.status === 'verified' ? 'verifiziert (SPF/DKIM)' : hit.status}` : `Domain ${dom} ist bei Resend nicht angelegt.` });
      }
    } catch { out.push({ id: 'mail', label: 'E-Mail-Absender', state: 'warn', info: 'Resend nicht erreichbar.' }); }
  }
  // Datenbank
  if (!adminConfigured()) out.push({ id: 'db', label: 'Datenbank', state: 'fail', info: 'Supabase-Service-Schlüssel fehlt.' });
  else {
    const t0 = Date.now();
    const { error } = await supabaseAdmin().from('immo_settings').select('key').limit(1);
    out.push({ id: 'db', label: 'Datenbank', state: error ? 'fail' : 'ok', info: error ? error.message.slice(0, 120) : `erreichbar (${Date.now() - t0} ms)` });
  }
  out.push({ id: 'cron', label: 'Täglicher Lauf', state: process.env.CRON_SECRET ? 'ok' : 'fail', info: process.env.CRON_SECRET ? 'CRON_SECRET gesetzt (läuft täglich 03:17 UTC).' : 'CRON_SECRET fehlt.' });
  out.push({ id: 'push', label: 'Sofort-Alarm (Telegram/Slack)', state: pushConfigured() ? 'ok' : 'warn', info: pushConfigured() ? 'eingerichtet' : 'optional: ALERT_TELEGRAM_BOT_TOKEN + ALERT_TELEGRAM_CHAT_ID oder ALERT_WEBHOOK_URL in Vercel setzen.' });
  return out;
}
