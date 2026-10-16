import { billingEnabled, entitlementsFor } from '@/lib/billing/stripe';
import { isAdminEmail } from '@/lib/security/admin';
import { adminConfigured } from '@/lib/supabase/admin';
import { effectiveTier, membershipFor } from '@/lib/b2b/core';

// Zahlender Kunde: gebuchter Tarif (B2C), Unternehmenskonto mit aktivem Tarif oder Administrator.
// Steuert u. a., ob Dokumente ohne Wasserzeichen ausgegeben werden (Gratis-Nutzung und Beispiele behalten es).
export async function paidAccess(user: { id: string; email: string }): Promise<{ paid: boolean; admin: boolean; b2b: boolean; tier: string }> {
  const admin = isAdminEmail(user.email);
  let tier = 'free';
  let b2b = false;
  if (billingEnabled()) {
    try { tier = (await entitlementsFor(user.id, user.email)).tier || 'free'; } catch { tier = 'free'; }
  }
  if (adminConfigured()) {
    try { const m = await membershipFor(user.id); b2b = Boolean(m && effectiveTier(m.account)); } catch { b2b = false; }
  }
  return { paid: admin || b2b || tier !== 'free', admin, b2b, tier };
}
