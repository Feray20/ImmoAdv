import { NextResponse } from 'next/server';

// Angebote exakt wie vom Betreiber festgelegt (Bruttopreise in Cent, inkl. 19 % USt).
const PLANS = {
  'credit-map': {
    amount: 3900,
    name: 'ImmoAdv Kreditmappe',
    mode: 'payment',
    description: 'Kreditmappe je Objekt inklusive Banken-Ready-Score, Grundbuch-Check und Fristen. Preis inkl. 19 % USt.',
  },
  pro: {
    amount: 1900,
    name: 'ImmoAdv Pro',
    mode: 'subscription',
    description: 'Pro-Zugang mit unbegrenzten Objekten, Mappen, Portfolio-Szenarien und Fristen. 19,00 € pro Monat inkl. 19 % USt, monatlich kündbar.',
  },
} as const;

type Plan = keyof typeof PLANS;

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: 'Stripe ist noch nicht konfiguriert.' }, { status: 503 });

  let plan: unknown;
  try {
    plan = ((await req.json()) as { plan?: unknown }).plan;
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
  if (typeof plan !== 'string' || !(plan in PLANS)) {
    return NextResponse.json({ error: 'Unbekanntes Angebot.' }, { status: 400 });
  }
  const p = PLANS[plan as Plan];

  const q = new URLSearchParams({
    mode: p.mode,
    success_url: 'https://immoadv.de/angebote?checkout=success',
    cancel_url: 'https://immoadv.de/angebote?checkout=cancel',
    locale: 'de',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(p.amount),
    'line_items[0][price_data][tax_behavior]': 'inclusive',
    'line_items[0][price_data][product_data][name]': p.name,
    'line_items[0][price_data][product_data][description]': p.description,
  });
  if (p.mode === 'subscription') q.set('line_items[0][price_data][recurring][interval]', 'month');

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: q.toString(),
    });
    const d = (await r.json()) as { url?: string; error?: { message?: string } };
    if (!r.ok) return NextResponse.json({ error: d.error?.message || 'Stripe Checkout Fehler.' }, { status: r.status });
    return NextResponse.json({ url: d.url });
  } catch {
    return NextResponse.json({ error: 'Checkout konnte nicht erstellt werden.' }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
