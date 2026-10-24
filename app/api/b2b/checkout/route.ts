import { z } from 'zod';
import { billingEnabled, stripe } from '@/lib/billing/stripe';
import { VERIFY_MSG } from '@/lib/b2b/core';
import { accountBranches, findPlan, getCatalog } from '@/lib/b2b/catalog';
import { json, requireMember } from '@/lib/b2b/http';
import { ensureAddonPrice, ensureB2BCustomer, ensureB2BPaymentConfig, ensureB2BPrice, ensureTaxRateExclusive, parseExtras } from '@/lib/b2b/stripe-b2b';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { CHECKOUT_BRANDING, NO_MANAGED_PAYMENTS } from '@/lib/billing/checkout-params';
import { intakeClosed } from '@/lib/security/panic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ plan: z.string(), terms: z.literal(true), extras: z.array(z.enum(['vermittler', 'makler', 'finanzberater', 'allgemein'])).max(3).optional() });

// Tarif für das Unternehmenskonto buchen (Kontoinhaber). Netto zzgl. USt, kein Widerrufsrecht (B2B).
export async function POST(req: Request) {
  if (await intakeClosed()) return json({ error: 'Vorübergehend nicht möglich (Wartung). Bitte später erneut versuchen.' }, 503);
  if (!billingEnabled()) return json({ error: 'Tarife sind noch nicht buchbar. Für einen Testzugang bitte an support@immoadv.de schreiben.' }, 503);
  const ctx = await requireMember(req, { owner: true, bucket: 'b2b-checkout', limit: 10 });
  if (ctx instanceof Response) return ctx;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: 'Bitte den Nutzungsbedingungen für Unternehmen zustimmen.' }, 400);
  const a = ctx.account;
  const cat = await getCatalog(true);
  const f = findPlan(cat, p.data.plan);
  const branches = accountBranches(a);
  // Pakete gibt es nur für die eigene Branche; Wechsel der Branche nur über den Support.
  if (!f || !f.plan.active) return json({ error: 'Unbekannter Tarif.' }, 400);
  if (f.branche !== branches[0]) return json({ error: `Dieses Paket gehört zu einer anderen Branche. Ihr Konto ist für „${cat.branchen[branches[0]].label}“ freigeschaltet – ein Wechsel ist über support@immoadv.de möglich.` }, 403);
  if (!cat.branchen[f.branche].selfService) return json({ error: 'Für Ihre Branche erstellen wir ein individuelles Angebot. Bitte wenden Sie sich an support@immoadv.de.' }, 403);
  const extras = [...new Set((p.data.extras || []).filter((x) => x !== branches[0]))];
  if (extras.length && !cat.addon.active) return json({ error: 'Zusatzbranchen sind derzeit nicht buchbar.' }, 400);
  if (!a.verified_at) return json({ error: VERIFY_MSG }, 403);
  if (a.plan_source === 'stripe' && a.plan_tier && a.stripe_subscription_id) {
    return json({ error: 'Es besteht bereits ein Abo. Wechsel und Kündigung über „Abo verwalten“.' }, 409);
  }
  try {
    const [customer, pr, tax, pmc] = await Promise.all([ensureB2BCustomer(a), ensureB2BPrice(p.data.plan), ensureTaxRateExclusive(), ensureB2BPaymentConfig()]);
    const addon = extras.length ? await ensureAddonPrice(pr.interval) : null;
    const metadata = { b2b_account_id: a.id, plan: p.data.plan, tier: pr.tier, branche: branches[0], extras: extras.join(','), terms_accepted: new Date().toISOString() };
    const origin = new URL(req.url).origin;
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: a.id,
      line_items: [{ price: pr.price, quantity: 1, tax_rates: [tax] }, ...(addon ? [{ price: addon, quantity: extras.length, tax_rates: [tax] }] : [])],
      locale: 'de',
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      allow_promotion_codes: true,
      // Button-Lösung (§ 312j Abs. 3 BGB): Hinweis direkt am Bestellknopf der Bezahlseite.
      custom_text: { submit: { message: 'Mit Klick auf den Button schließen Sie einen zahlungspflichtigen Vertrag mit ImmoAdv ab.' } },
      ...NO_MANAGED_PAYMENTS,
      ...CHECKOUT_BRANDING,
      ...(pmc ? { payment_method_configuration: pmc } : {}),
      metadata,
      subscription_data: { metadata, description: `${pr.name}${extras.length ? ` + ${extras.length} Zusatzbranche(n)` : ''}` },
      success_url: `${origin}/b2b-portal?checkout=success#tarif`,
      cancel_url: `${origin}/b2b-portal?checkout=cancel#tarif`,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error('b2b_checkout_error', e instanceof Error ? e.message : e);
    return json({ error: 'Bezahlseite konnte nicht geöffnet werden.' }, 502);
  }
}

// Abo verwalten (Zahlungsmittel, Rechnungen, Kündigung) über das Stripe-Kundenportal.
export async function PUT(req: Request) {
  if (!billingEnabled()) return json({ error: 'Nicht verfügbar.' }, 503);
  const ctx = await requireMember(req, { owner: true, allowLocked: true, bucket: 'b2b-checkout', limit: 10 });
  if (ctx instanceof Response) return ctx;
  if (!ctx.account.stripe_customer_id) return json({ error: 'Noch kein Abo vorhanden.' }, 404);
  const s = await stripe().billingPortal.sessions.create({ customer: ctx.account.stripe_customer_id, locale: 'de', return_url: `${new URL(req.url).origin}/b2b-portal#tarif` });
  return json({ url: s.url });
}

// Zusatzbranche zu einem laufenden Abo dazubuchen (anteilig berechnet). Nur Kontoinhaber, nur mit Stripe-Abo.
const AddBody = z.object({ branche: z.enum(['vermittler', 'makler', 'finanzberater', 'allgemein']), terms: z.literal(true) });
export async function PATCH(req: Request) {
  if (!billingEnabled()) return json({ error: 'Nicht verfügbar.' }, 503);
  const ctx = await requireMember(req, { owner: true, bucket: 'b2b-checkout', limit: 10 });
  if (ctx instanceof Response) return ctx;
  const p = AddBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: 'Bitte Branche wählen und den Bedingungen zustimmen.' }, 400);
  const a = ctx.account;
  const cat = await getCatalog(true);
  if (!cat.addon.active) return json({ error: 'Zusatzbranchen sind derzeit nicht buchbar.' }, 400);
  const branches = accountBranches(a);
  if (branches.includes(p.data.branche)) return json({ error: 'Diese Branche ist bereits freigeschaltet.' }, 409);
  if (a.plan_source !== 'stripe' || !a.stripe_subscription_id) return json({ error: 'Zusatzbranchen lassen sich mit einem gebuchten Abo dazubuchen. Bei Rechnungskauf bitte an support@immoadv.de wenden.' }, 409);
  try {
    const s = stripe();
    const sub = await s.subscriptions.retrieve(a.stripe_subscription_id);
    const interval = sub.items.data.find((i) => !i.price?.metadata?.immoadv_b2b_addon)?.price?.recurring?.interval === 'year' ? 'year' : 'month';
    const addon = await ensureAddonPrice(interval);
    const extras = [...parseExtras(sub.metadata?.extras), p.data.branche];
    const existing = sub.items.data.find((i) => i.price?.metadata?.immoadv_b2b_addon === 'branche');
    if (existing && existing.price.id === addon) await s.subscriptionItems.update(existing.id, { quantity: extras.length, proration_behavior: 'create_prorations' });
    else {
      if (existing) await s.subscriptionItems.del(existing.id, { proration_behavior: 'create_prorations' });
      const tax = await ensureTaxRateExclusive();
      await s.subscriptionItems.create({ subscription: sub.id, price: addon, quantity: extras.length, tax_rates: [tax], proration_behavior: 'create_prorations' });
    }
    await s.subscriptions.update(sub.id, { metadata: { ...sub.metadata, extras: extras.join(',') } });
    await supabaseAdmin().from('immo_b2b_accounts').update({ extra_branches: extras, updated_at: new Date().toISOString() }).eq('id', a.id);
    return json({ ok: true, extras });
  } catch (e) {
    console.error('b2b_addon_error', e instanceof Error ? e.message : e);
    return json({ error: 'Zusatzbranche konnte nicht gebucht werden.' }, 502);
  }
}
