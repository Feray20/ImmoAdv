export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'Stripe ist noch nicht konfiguriert.' });
  const origin = req.headers.origin || `https://${req.headers.host}`;
  const params = new URLSearchParams({ type: 'document', return_url: `${origin}/?identity=complete#preise` });
  const response = await fetch('https://api.stripe.com/v1/identity/verification_sessions', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  const data = await response.json();
  if (!response.ok) { console.error('Stripe Identity error', data); return res.status(502).json({ error: 'Identitätsprüfung konnte nicht gestartet werden.' }); }
  return res.status(200).json({ url: data.url, id: data.id });
}