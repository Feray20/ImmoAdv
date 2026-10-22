import type Stripe from 'stripe';
import { PLANS, type Plan } from '@/lib/billing/stripe';

// Gemeinsame Einstellungen der Bezahlseite (echter Kauf und Testkauf im Web-Admin).
// Zahlarten werden bewusst NICHT festgelegt: Stripe zeigt automatisch alle im Stripe-Konto aktivierten Zahlarten
// (Karte, PayPal, Apple Pay, Google Pay, Klarna, SEPA …). Logo und Farben kommen aus Stripe → Einstellungen → Branding.
// Stripe-Feld ist evtl. noch nicht in den SDK-Typen, daher als Spread.
export const NO_MANAGED_PAYMENTS = { managed_payments: { enabled: false } } as unknown as Partial<Stripe.Checkout.SessionCreateParams>;

export function checkoutParams(o: {
  plan: Plan; customer: string; clientRef: string; price: string; taxRate: string;
  metadata: Record<string, string>; successUrl: string; cancelUrl: string; addonPrice?: string | null;
}): Stripe.Checkout.SessionCreateParams {
  const def = PLANS[o.plan];
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: def.mode,
    customer: o.customer,
    client_reference_id: o.clientRef,
    line_items: [{ price: o.price, quantity: 1, tax_rates: [o.taxRate] }, ...(o.addonPrice && def.mode === 'payment' ? [{ price: o.addonPrice, quantity: 1, tax_rates: [o.taxRate] }] : [])],
    locale: 'de',
    // Gutscheincode-Feld auf der Bezahlseite: Aktionscodes (z. B. für Kooperationspartner) werden im Stripe-Dashboard angelegt;
    // Einlösungen je Code sind dort auswertbar (Grundlage für Partnerprovisionen).
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    // Button-Lösung (§ 312j Abs. 3 BGB): Hinweis direkt am Bestellknopf der Bezahlseite.
    custom_text: {
      submit: { message: 'Mit Klick auf den Button schließen Sie einen zahlungspflichtigen Vertrag mit ImmoAdv ab.' },
      after_submit: { message: 'Danke! Sie werden gleich zu ImmoAdv zurückgeleitet. Rechnung und Beleg erhalten Sie per E-Mail.' },
    },
    // Managed Payments (Stripe als Händler) ist im Stripe-Konto standardmäßig an und verträgt sich nicht mit
    // custom_text, eigenen Steuersätzen und eigener Rechnung. ImmoAdv verkauft selbst → pro Anfrage ausschalten.
    ...NO_MANAGED_PAYMENTS,
    metadata: o.metadata,
    success_url: o.successUrl,
    cancel_url: o.cancelUrl,
  };
  if (def.mode === 'payment') {
    params.submit_type = 'pay';
    params.invoice_creation = {
      enabled: true,
      invoice_data: {
        description: def.description,
        metadata: o.metadata,
        rendering_options: { amount_tax_display: 'include_inclusive_tax' },
        footer: 'ImmoAdv · Feray Korkmaz · Georg-August-Zinn-Str. 25 · 64354 Reinheim · USt-IdNr. DE348036700',
      },
    };
    params.payment_intent_data = { metadata: o.metadata, description: def.description };
  } else {
    params.subscription_data = { metadata: o.metadata, description: def.description };
  }
  return params;
}
