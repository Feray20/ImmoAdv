export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'Stripe ist noch nicht konfiguriert.' });
  const plans = {
    kreditmappe: { mode: 'payment', name: 'ImmoAdv Kreditmappe', description: 'Erweiterte Objektanalyse, Banken-Ready-Score und strukturierte Unterlagen.', amount: 3900 },
    pro: { mode: 'subscription', name: 'ImmoAdv Pro', description: 'Professionelle Immobilienanalyse mit mehreren Objekten und erweiterten Szenarien.', amount: 1900, recurring: 'month' }
  };
  const plan = plans[req.body?.plan];
  if (!plan) return res.status(400).json({ error: 'Unbekannter Plan.' });
  const origin = req.headers.origin || `https://${req.headers.host}`;
  const params = new URLSearchParams();
  params.set('mode', plan.mode); params.set('success_url', `${origin}/?checkout=success&plan=${encodeURIComponent(req.body.plan)}#preise`); params.set('cancel_url', `${origin}/?checkout=cancelled#preise`);
  params.set('customer_creation', 'always'); params.set('billing_address_collection', 'required'); params.set('tax_id_collection[enabled]', 'true'); params.set('allow_promotion_codes', 'true');
  params.set('line_items[0][quantity]', '1'); params.set('line_items[0][price_data][currency]', 'eur'); params.set('line_items[0][price_data][product_data][name]', plan.name); params.set('line_items[0][price_data][product_data][description]', plan.description); params.set('line_items[0][price_data][unit_amount]', String(plan.amount));
  if (plan.mode === 'subscription') params.set('line_items[0][price_data][recurring][interval]', plan.recurring); else params.set('invoice_creation[enabled]', 'true');
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  const data = await response.json();
  if (!response.ok) { console.error('Stripe Checkout error', data); return res.status(502).json({ error: 'Stripe Checkout konnte nicht erstellt werden.' }); }
  return res.status(200).json({ url: data.url });
}