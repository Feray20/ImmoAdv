import { z } from 'zod';
import { userFromRequest } from '@/lib/billing/auth';
import { allowRequest } from '@/lib/security/rate-limit';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { AVV_VERSION, TIER_LIMITS, adminAudit, dossiersThisMonth, effectiveTier, membershipFor, newWidgetKey, slugify, type B2BAccount } from '@/lib/b2b/core';
import { json, requireMember } from '@/lib/b2b/http';
import { adminList } from '@/lib/security/admin';
import { mailConfigured, sendMail } from '@/lib/notify/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGISTER_RE = /^D-[A-Z0-9]{1,4}(-[A-Z0-9]{1,8}){1,6}$/i; // Vermittlerregister (DIHK), z. B. D-W-123-ABCD-12
const VATID_RE = /^DE[0-9]{9}$/;
const STNR_RE = /^[0-9][0-9 /]{8,18}[0-9]$/;
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

const RegisterSchema = z.object({
  companyName: z.string().transform(clean).pipe(z.string().min(2).max(160)),
  legalForm: z.string().transform(clean).pipe(z.string().min(1).max(60)),
  institutionType: z.enum(['BANK', 'BROKER', 'REALTOR', 'OTHER']),
  registerNumber: z.string().transform(clean).optional().default(''),
  taxId: z.string().transform((s) => s.replace(/\s+/g, '').toUpperCase()).optional().default(''),
  advisorName: z.string().transform(clean).pipe(z.string().min(2).max(120)),
  phone: z.string().transform(clean).pipe(z.string().max(40)).optional().default(''),
  street: z.string().transform(clean).pipe(z.string().min(3).max(160)),
  postalCode: z.string().regex(/^[0-9]{5}$/),
  city: z.string().transform(clean).pipe(z.string().min(2).max(80)),
  unternehmer: z.literal(true),
  avv: z.literal(true),
  partnerCode: z.string().transform((s) => s.trim().toUpperCase()).optional().default(''),
  referral: z.string().max(40).optional().default(''),
});

const PatchSchema = z.object({
  advisorName: z.string().transform(clean).pipe(z.string().min(2).max(120)).optional(),
  phone: z.string().transform(clean).pipe(z.string().max(40)).optional(),
  street: z.string().transform(clean).pipe(z.string().min(3).max(160)).optional(),
  postalCode: z.string().regex(/^[0-9]{5}$/).optional(),
  city: z.string().transform(clean).pipe(z.string().min(2).max(80)).optional(),
  bookingUrl: z.union([z.literal(''), z.string().url().max(300).refine((u) => u.startsWith('https://'), 'https erforderlich')]).optional(),
  brandColor: z.union([z.literal(''), z.string().regex(/^#[0-9A-Fa-f]{6}$/)]).optional(),
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/).optional(),
  allowedDomains: z.array(z.string().regex(/^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/i).max(100)).max(10).optional(),
  leadGate: z.boolean().optional(),
  widgetActive: z.boolean().optional(),
  regenerateKey: z.literal(true).optional(),
  supportAccessDays: z.union([z.literal(0), z.literal(7)]).optional(),
  acceptSubmissions: z.boolean().optional(),
  customDisclaimer: z.string().trim().max(600).optional(),
});

function view(a: B2BAccount, role: string) {
  const tier = effectiveTier(a);
  return {
    role,
    tier,
    limits: tier ? TIER_LIMITS[tier] : null,
    account: {
      customerNumber: a.customer_number, companyName: a.company_name, legalForm: a.legal_form, institutionType: a.institution_type,
      registerNumber: a.register_number, taxId: a.tax_id, advisorName: a.advisor_name, email: a.email, phone: a.phone,
      street: a.street, postalCode: a.postal_code, city: a.city, status: a.status, lockReason: a.lock_reason, verified: Boolean(a.verified_at),
      planTier: a.plan_tier, planSource: a.plan_source, planUntil: a.plan_until, billingInterval: a.billing_interval,
      dossierBonus: a.dossier_bonus, hasWhitelabel: a.has_whitelabel, allowInvoicePayment: a.allow_invoice_payment,
      avvAcceptedAt: a.avv_accepted_at, avvVersion: a.avv_version, unternehmerConfirmedAt: a.unternehmer_confirmed_at,
      hasLogo: Boolean(a.logo_path), brandColor: a.brand_color, bookingUrl: a.booking_url, slug: a.slug,
      widgetKey: role === 'owner' ? a.widget_key : null, widgetActive: a.widget_active, allowedDomains: a.allowed_domains, leadGate: a.lead_gate,
      createdAt: a.created_at, supportAccessUntil: a.support_access_until ?? null, acceptSubmissions: Boolean(a.accept_submissions), customDisclaimer: a.custom_disclaimer ?? null,
    },
  };
}

export async function GET(req: Request) {
  if (!adminConfigured()) return json({ error: 'Nicht konfiguriert.' }, 503);
  const user = await userFromRequest(req);
  if (!user) return json({ error: 'Bitte zuerst anmelden.' }, 401);
  if (!allowRequest(`b2b-get:${user.id}`, 60, 60_000)) return json({ error: 'Zu viele Anfragen.' }, 429);
  const m = await membershipFor(user.id);
  if (!m) return json({ account: null, avvVersion: AVV_VERSION });
  const db = supabaseAdmin();
  const [{ count: seats }, used, { count: leadsNew }] = await Promise.all([
    db.from('immo_b2b_members').select('user_id', { count: 'exact', head: true }).eq('account_id', m.account.id),
    dossiersThisMonth(m.account.id),
    db.from('immo_b2b_leads').select('id', { count: 'exact', head: true }).eq('account_id', m.account.id).eq('status', 'neu'),
  ]);
  return json({ ...view(m.account, m.role), usage: { seats: seats ?? 1, dossiersThisMonth: used, leadsNew: leadsNew ?? 0 }, avvVersion: AVV_VERSION });
}

// Registrierung eines Unternehmenskontos (nur Unternehmer nach § 14 BGB, mit AVV nach Art. 28 DSGVO).
export async function POST(req: Request) {
  if (!adminConfigured()) return json({ error: 'Nicht konfiguriert.' }, 503);
  const user = await userFromRequest(req);
  if (!user) return json({ error: 'Bitte zuerst anmelden.' }, 401);
  if (!allowRequest(`b2b-register:${user.id}`, 5, 60_000)) return json({ error: 'Zu viele Anfragen.' }, 429);
  const parsed = RegisterSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const f = parsed.error.issues[0]?.path[0];
    const msg: Record<string, string> = {
      unternehmer: 'Bitte bestätigen, dass Sie als Unternehmer handeln (§ 14 BGB).',
      avv: 'Bitte dem Auftragsverarbeitungsvertrag zustimmen.',
      postalCode: 'Bitte eine fünfstellige Postleitzahl angeben.',
      street: 'Bitte Straße und Hausnummer angeben.',
    };
    return json({ error: msg[String(f)] ?? `Bitte die Angabe „${String(f ?? 'Formular')}“ prüfen.` }, 400);
  }
  const b = parsed.data;
  const reg = b.registerNumber.toUpperCase();
  if (!reg && !b.taxId) return json({ error: 'Bitte Vermittler-Registernummer oder Steuernummer/USt-IdNr. angeben.' }, 400);
  if (reg && !REGISTER_RE.test(reg)) return json({ error: 'Registernummer im Format D-XXXX-XXXX-XX angeben (Vermittlerregister).' }, 400);
  if (b.taxId && !(VATID_RE.test(b.taxId) || STNR_RE.test(b.taxId))) return json({ error: 'USt-IdNr. (DE + 9 Ziffern) oder Steuernummer prüfen.' }, 400);
  if ((b.institutionType === 'BROKER' || b.institutionType === 'REALTOR') && !reg && !b.taxId) return json({ error: 'Registernummer angeben.' }, 400);

  if (await membershipFor(user.id)) return json({ error: 'Dieses Konto gehört bereits zu einem Unternehmen.' }, 409);
  const db = supabaseAdmin();

  // Freie Partner-URL aus dem Firmennamen ableiten.
  const base = slugify(b.companyName).replace(/-(gmbh|ug|ag|kg|ohg|gbr|e-k|mbh)$/g, '').slice(0, 34) || 'partner';
  let slug = base.length >= 3 ? base : `${base}-partner`;
  for (let i = 2; i < 50; i++) {
    const { data } = await db.from('immo_b2b_accounts').select('id').eq('slug', slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }

  let referral = b.referral.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || null;
  if (b.partnerCode) {
    const { data: code } = await db.from('immo_b2b_partner_codes').select('*').eq('code', b.partnerCode).maybeSingle();
    if (!code || !code.active || (code.max_redemptions != null && code.redeemed >= code.max_redemptions)) return json({ error: 'Partnercode ist nicht gültig.' }, 400);
    await db.from('immo_b2b_partner_codes').update({ redeemed: code.redeemed + 1 }).eq('code', code.code).eq('redeemed', code.redeemed);
    referral = `code:${code.code}`.slice(0, 40);
  }

  const now = new Date().toISOString();
  const ins = await db.from('immo_b2b_accounts').insert({
    owner_id: user.id, company_name: b.companyName, legal_form: b.legalForm, institution_type: b.institutionType,
    register_number: reg || null, tax_id: b.taxId || null, advisor_name: b.advisorName, email: user.email, phone: b.phone || null,
    street: b.street, postal_code: b.postalCode, city: b.city, status: 'active', unternehmer_confirmed_at: now,
    avv_accepted_at: now, avv_version: AVV_VERSION, referral, slug, widget_key: newWidgetKey(),
  }).select('*').single();
  if (ins.error || !ins.data) {
    console.error('b2b_register_error', ins.error?.message);
    return json({ error: 'Registrierung fehlgeschlagen.' }, 500);
  }
  const mem = await db.from('immo_b2b_members').insert({ account_id: ins.data.id, user_id: user.id, role: 'owner' });
  if (mem.error) {
    await db.from('immo_b2b_accounts').delete().eq('id', ins.data.id);
    return json({ error: 'Registrierung fehlgeschlagen.' }, 500);
  }
  await adminAudit(user.email, 'b2b_register', ins.data.id, { avv: AVV_VERSION, unternehmer: true, type: b.institutionType });
  if (mailConfigured()) {
    for (const to of adminList()) {
      await sendMail(to, `Neues Unternehmenskonto: ${b.companyName}`, `${b.companyName} (${b.legalForm}, ${b.institutionType})\n${b.advisorName}, ${b.postalCode} ${b.city}\nKundennummer: ${ins.data.customer_number}\n\nPrüfen und verifizieren: https://immoadv.de/intern/objektsuche#b2b`);
    }
    await sendMail(user.email, 'Ihr ImmoAdv-Unternehmenskonto', `Guten Tag ${b.advisorName},\n\nIhr Unternehmenskonto für ${b.companyName} ist angelegt (Kundennummer ${ins.data.customer_number}).\nDen Auftragsverarbeitungsvertrag (Version ${AVV_VERSION}) können Sie jederzeit im Portal herunterladen: https://immoadv.de/b2b-portal#profil\n\nImmoAdv · Georg-August-Zinn-Str. 25 · 64354 Reinheim`);
  }
  return json({ ok: true, ...view(ins.data as B2BAccount, 'owner') }, 201);
}

export async function PATCH(req: Request) {
  const ctx = await requireMember(req, { owner: true, bucket: 'b2b-patch', limit: 30 });
  if (ctx instanceof Response) return ctx;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: `Bitte die Angabe „${String(parsed.error.issues[0]?.path[0] ?? '')}“ prüfen.` }, 400);
  const p = parsed.data;
  const up: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.advisorName !== undefined) up.advisor_name = p.advisorName;
  if (p.phone !== undefined) up.phone = p.phone || null;
  if (p.street !== undefined) up.street = p.street;
  if (p.postalCode !== undefined) up.postal_code = p.postalCode;
  if (p.city !== undefined) up.city = p.city;
  if (p.bookingUrl !== undefined) up.booking_url = p.bookingUrl || null;
  if (p.brandColor !== undefined) up.brand_color = p.brandColor || null;
  if (p.allowedDomains !== undefined) up.allowed_domains = [...new Set(p.allowedDomains.map((d) => d.toLowerCase()))];
  if (p.leadGate !== undefined) up.lead_gate = p.leadGate;
  if (p.widgetActive !== undefined) up.widget_active = p.widgetActive;
  if (p.regenerateKey) up.widget_key = newWidgetKey();
  // Support-Zugriff: Betreiber darf das Portal 7 Tage lesend einsehen (Auftragsverarbeitung nur auf Weisung).
  if (p.acceptSubmissions !== undefined) {
    if (p.acceptSubmissions && ctx.account.institution_type !== 'BANK') return json({ error: 'Einreichungen empfangen können nur Kreditinstitute.' }, 400);
    up.accept_submissions = p.acceptSubmissions;
  }
  if (p.customDisclaimer !== undefined) {
    if (p.customDisclaimer && effectiveTier(ctx.account) !== 'ENTERPRISE' && !ctx.account.has_whitelabel) return json({ error: 'Eigene Hinweistexte gibt es im Tarif Enterprise.' }, 402);
    up.custom_disclaimer = p.customDisclaimer || null;
  }
  if (p.supportAccessDays !== undefined) up.support_access_until = p.supportAccessDays ? new Date(Date.now() + p.supportAccessDays * 864e5).toISOString() : null;
  const db = supabaseAdmin();
  if (p.slug !== undefined && p.slug !== ctx.account.slug) {
    if (/^(admin|api|intern|b2b|app|auth|verify|p)(-|$)/.test(p.slug)) return json({ error: 'Diese Adresse ist reserviert.' }, 400);
    const { data } = await db.from('immo_b2b_accounts').select('id').eq('slug', p.slug).maybeSingle();
    if (data) return json({ error: 'Diese Adresse ist vergeben.' }, 409);
    up.slug = p.slug;
  }
  const r = await db.from('immo_b2b_accounts').update(up).eq('id', ctx.account.id).select('*').single();
  if (r.error || !r.data) return json({ error: 'Speichern fehlgeschlagen.' }, 500);
  return json({ ok: true, ...view(r.data as B2BAccount, ctx.role) });
}
