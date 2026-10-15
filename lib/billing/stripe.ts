import Stripe from 'stripe';

// Zentrale Stripe-Logik. Stripe ist die einzige Quelle der Wahrheit für Käufe:
// Es gibt keine eigene Zahlungsdatenbank, Freischaltungen werden aus Stripe gelesen.

export type Plan = 'credit-map' | 'pro-monthly' | 'pro-yearly';

type PlanDef = {
  lookupKey: string;
  name: string;
  description: string;
  amount: number; // Bruttobetrag in Cent inkl. 19 % USt
  mode: 'payment' | 'subscription';
};

export const PLANS: Record<Plan, PlanDef> = {
  'credit-map': {
    lookupKey: 'immoadv_credit_map_4900',
    name: 'ImmoAdv Kreditmappe',
    description: 'Kreditmappe für ein Objekt (einmalig).',
    amount: 4900,
    mode: 'payment',
  },
  'pro-monthly': {
    lookupKey: 'immoadv_pro_monthly_2900',
    name: 'ImmoAdv Pro (monatlich)',
    description: 'Pro-Zugang, monatlich kündbar zum Ende des Abrechnungsmonats.',
    amount: 2900,
    mode: 'subscription',
  },
  'pro-yearly': {
    lookupKey: 'immoadv_pro_12m_29000',
    name: 'ImmoAdv Pro (12 Monate)',
    description: 'Pro-Zugang für 12 Monate. Endet automatisch, keine Verlängerung.',
    amount: 29000,
    mode: 'payment',
  },
};

export const isPlan = (v: unknown): v is Plan => typeof v === 'string' && v in PLANS;

export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY) && process.env.BILLING_ENABLED === 'true';
}

let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY fehlt');
  if (!client) client = new Stripe(key);
  return client;
}

// Preis per lookup_key holen oder einmalig anlegen.
export async function ensurePrice(plan: Plan): Promise<string> {
  const def = PLANS[plan];
  const s = stripe();
  const found = await s.prices.list({ lookup_keys: [def.lookupKey], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const price = await s.prices.create({
    currency: 'eur',
    unit_amount: def.amount,
    tax_behavior: 'inclusive',
    lookup_key: def.lookupKey,
    product_data: { name: def.name, metadata: { immoadv_plan: plan } },
    ...(def.mode === 'subscription' ? { recurring: { interval: 'month' as const } } : {}),
    metadata: { immoadv_plan: plan },
  });
  return price.id;
}

// Steuersatz 19 % USt (inklusive) holen oder anlegen, damit Rechnungen die Umsatzsteuer ausweisen.
export async function ensureTaxRate(): Promise<string> {
  const s = stripe();
  const list = await s.taxRates.list({ active: true, inclusive: true, limit: 100 });
  const hit = list.data.find((t) => t.metadata?.immoadv === 'ust19');
  if (hit) return hit.id;
  const t = await s.taxRates.create({
    display_name: 'USt',
    description: 'Umsatzsteuer 19 %',
    percentage: 19,
    inclusive: true,
    country: 'DE',
    jurisdiction: 'DE',
    metadata: { immoadv: 'ust19' },
  });
  return t.id;
}

// Genau einen Stripe-Kunden je Supabase-Nutzer verwenden.
export async function findCustomer(userId: string, email: string): Promise<Stripe.Customer | null> {
  const list = await stripe().customers.list({ email, limit: 20 });
  return list.data.find((c) => c.metadata?.supabase_user_id === userId) ?? null;
}

export async function ensureCustomer(userId: string, email: string): Promise<Stripe.Customer> {
  const existing = await findCustomer(userId, email);
  if (existing) return existing;
  return stripe().customers.create({
    email,
    preferred_locales: ['de'],
    metadata: { supabase_user_id: userId },
  });
}

export type Entitlements = {
  pro: boolean;
  proSource: 'subscription' | 'pass' | null;
  proUntil: string | null;
  creditMaps: number;
  hasCustomer: boolean;
};

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Freischaltungen aus Stripe ableiten (bezahlte Checkout-Sessions und aktive Abos).
export async function entitlementsFor(userId: string, email: string): Promise<Entitlements> {
  const customer = await findCustomer(userId, email);
  if (!customer) return { pro: false, proSource: null, proUntil: null, creditMaps: 0, hasCustomer: false };
  const s = stripe();

  const subs = await s.subscriptions.list({ customer: customer.id, status: 'all', limit: 20 });
  const activeSub = subs.data.find((x) => ['active', 'trialing', 'past_due'].includes(x.status));

  const sessions = await s.checkout.sessions.list({ customer: customer.id, limit: 100 });
  const paid = sessions.data.filter((x) => x.payment_status === 'paid' && x.metadata?.supabase_user_id === userId);
  const creditMaps = paid.filter((x) => x.metadata?.plan === 'credit-map').length;
  const passes = paid
    .filter((x) => x.metadata?.plan === 'pro-yearly')
    .map((x) => x.created * 1000 + YEAR_MS)
    .filter((until) => until > Date.now())
    .sort((a, b) => b - a);

  if (activeSub) return { pro: true, proSource: 'subscription', proUntil: null, creditMaps, hasCustomer: true };
  if (passes[0]) return { pro: true, proSource: 'pass', proUntil: new Date(passes[0]).toISOString(), creditMaps, hasCustomer: true };
  return { pro: false, proSource: null, proUntil: null, creditMaps, hasCustomer: true };
}
