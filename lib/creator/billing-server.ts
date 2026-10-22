import { createHash, randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  blockers, closeAllowedAt, commissionLines, creditNoteNumber, eurText, periodBounds, periodLabel, statementStatusAfterClose, statementTotals, taxTreatment,
  type AdjustmentIn, type BillingMode, type BusinessIn, type ConversionIn, type Rule, type TaxTreatment,
} from '@/lib/creator/billing';
import { maskIban } from '@/lib/creator/iban';
import { renderDoc, type DocLine } from '@/lib/creator/pdf';
import { audit, type Actor } from '@/lib/creator/server';

// Serverseitige Abrechnung: Monatsabschluss, Freigabe, Dokumente (Abrechnung, Rechnung, Gutschrift), Auszahlungen.
// Alle Beträge werden hier aus der Datenbank berechnet – nie aus Eingaben des Browsers übernommen.

export const DOC_BUCKET = 'creator-documents';
const db = () => supabaseAdmin();
const dDE = (d: Date | string) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date(d));
const PLAN: Record<string, string> = { starter: 'Käufer-Pass', pro: 'Investor Pro' };

export const ISSUER = { name: 'ImmoAdv', owner: 'Feray Korkmaz', street: 'Georg-August-Zinn-Str. 25', city: '64354 Reinheim', country: 'DE', vatId: 'DE348036700' };

async function setting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db().from('immo_settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

export function servicePeriodText(period: string): string {
  const b = periodBounds(period);
  return `${dDE(b.from)} - ${dDE(new Date(b.to.getTime() - 1000))}`;
}

type CreatorFacts = { id: string; status: string; billing_mode: BillingMode; display_name: string | null; first_name: string | null; last_name: string | null; user_id: string };

async function factsFor(ids: string[]) {
  const [cr, bus, pay, agr] = await Promise.all([
    db().from('immo_creators').select('id, status, billing_mode, display_name, first_name, last_name, user_id').in('id', ids),
    db().from('immo_creator_business').select('*').in('creator_id', ids),
    db().from('immo_creator_payout_accounts').select('id, creator_id, status, iban_country, iban_last4, holder_name').in('creator_id', ids).neq('status', 'SUPERSEDED'),
    db().from('immo_creator_agreements').select('id').not('published_at', 'is', null).order('published_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const acc = agr.data ? await db().from('immo_creator_agreement_acceptances').select('creator_id').eq('agreement_id', agr.data.id).in('creator_id', ids) : { data: [] };
  const accepted = new Set(((acc.data ?? []) as { creator_id: string }[]).map((x) => x.creator_id));
  return {
    creators: new Map(((cr.data ?? []) as CreatorFacts[]).map((c) => [c.id, c])),
    business: new Map(((bus.data ?? []) as (BusinessIn & Record<string, unknown> & { creator_id: string })[]).map((b) => [b.creator_id, b])),
    payout: new Map(((pay.data ?? []) as { id: string; creator_id: string; status: string; iban_country: string; iban_last4: string; holder_name: string }[]).map((p) => [p.creator_id, p])),
    accepted,
  };
}

const noBusiness: BusinessIn = { country: 'DE', vat_status: 'not_applicable', vat_id: null, tax_number: null };

// ---------------- Monatsabschluss ----------------
export async function closePeriod(period: string, actor: Actor, now = new Date()): Promise<{ closed: number; clawbacks: number; carried: number }> {
  const delay = Number(await setting('creator_close_delay_days', 15)) || 15;
  if (now < closeAllowedAt(period, delay)) throw new Error(`Abschluss ab ${dDE(closeAllowedAt(period, delay))} möglich (Widerrufsfrist).`);
  const { from, to } = periodBounds(period);

  // 1) Erstattungen nach einem Abschluss → Rückforderung in diesem Monat
  const { data: rev } = await db().from('immo_creator_commissions').select('id, conversion_id, creator_id, commission_cents, status, immo_creator_conversions!inner(status)')
    .neq('status', 'CLAWED_BACK').eq('immo_creator_conversions.status', 'REVERSED');
  let clawbacks = 0;
  for (const c of (rev ?? []) as { id: string; creator_id: string; commission_cents: number }[]) {
    if (c.commission_cents > 0) {
      const ins = await db().from('immo_creator_adjustments').upsert({ creator_id: c.creator_id, period, kind: 'CLAWBACK', amount_cents: -c.commission_cents, reason: 'Rückforderung: Kauf wurde erstattet', source_id: c.id, created_by: actor.ref }, { onConflict: 'kind,source_id', ignoreDuplicates: true }).select('id');
      if (ins.data?.length) clawbacks++;
    }
    await db().from('immo_creator_commissions').update({ status: 'CLAWED_BACK' }).eq('id', c.id);
  }

  // 2) Negative Salden früherer Monate übertragen
  const { data: neg } = await db().from('immo_creator_statements').select('id, creator_id, net_cents').lt('net_cents', 0).eq('carried_over', false).lt('period', period);
  let carried = 0;
  for (const s of (neg ?? []) as { id: string; creator_id: string; net_cents: number }[]) {
    await db().from('immo_creator_adjustments').upsert({ creator_id: s.creator_id, period, kind: 'CARRY_OVER', amount_cents: s.net_cents, reason: 'Übertrag negativer Saldo aus Vormonat', source_id: s.id, created_by: actor.ref }, { onConflict: 'kind,source_id', ignoreDuplicates: true });
    await db().from('immo_creator_statements').update({ carried_over: true }).eq('id', s.id);
    carried++;
  }

  // 3) Offene Conversions des Monats (noch nicht provisioniert) und offene Anpassungen
  const [convRes, adjRes, rulesRes, doneRes] = await Promise.all([
    db().from('immo_creator_conversions').select('id, creator_id, campaign_slug, amount_net_cents, occurred_at, plan, source, immo_creator_commissions(id)').eq('status', 'PENDING').gte('occurred_at', from.toISOString()).lt('occurred_at', to.toISOString()),
    db().from('immo_creator_adjustments').select('id, creator_id, kind, amount_cents, reason, period').is('statement_id', null).lte('period', period),
    db().from('immo_creator_commission_rules').select('*'),
    db().from('immo_creator_statements').select('creator_id').eq('period', period),
  ]);
  const done = new Set(((doneRes.data ?? []) as { creator_id: string }[]).map((x) => x.creator_id));
  const conversions = ((convRes.data ?? []) as (ConversionIn & { immo_creator_commissions?: { id: string }[] | { id: string } | null })[])
    .filter((c) => !(Array.isArray(c.immo_creator_commissions) ? c.immo_creator_commissions.length : c.immo_creator_commissions)).filter((c) => !done.has(c.creator_id));
  const adjustments = ((adjRes.data ?? []) as (AdjustmentIn & { id: string; creator_id: string })[]).filter((a) => !done.has(a.creator_id));
  const rules = (rulesRes.data ?? []) as Rule[];
  const ids = [...new Set([...conversions.map((c) => c.creator_id), ...adjustments.map((a) => a.creator_id)])];
  if (!ids.length) { await audit('PERIOD_CLOSED', null, actor, 'SUCCESS', { period, statements: 0 }); return { closed: 0, clawbacks, carried }; }

  const f = await factsFor(ids);
  const lines = commissionLines(rules, conversions);
  const payload = ids.map((cid) => {
    const c = f.creators.get(cid);
    const b = (f.business.get(cid) ?? noBusiness) as BusinessIn & Record<string, unknown>;
    const tax = taxTreatment({ country: String(b.country || 'DE'), vat_status: b.vat_status, vat_id: (b.vat_id as string) ?? null, tax_number: (b.tax_number as string) ?? null });
    const myLines = lines.filter((l) => l.creator_id === cid);
    const myAdj = adjustments.filter((a) => a.creator_id === cid);
    const t = statementTotals(myLines.map((l) => l.commission_cents), myAdj, tax);
    const mode: BillingMode = c?.billing_mode === 'CREDIT_NOTE' ? 'CREDIT_NOTE' : 'INVOICE';
    return {
      creator_id: cid, status: statementStatusAfterClose(mode, t.payout_cents), billing_mode: mode,
      conversions: myLines.length, revenue_net_cents: myLines.reduce((a, l) => a + l.base_cents, 0),
      commission_cents: t.commission_cents, adjustments_cents: t.adjustments_cents, net_cents: t.net_cents, vat_rate_bps: tax.rate_bps, vat_cents: t.vat_cents,
      gross_cents: t.gross_cents, payout_cents: t.payout_cents, tax_mode: tax.mode, tax_note: tax.note,
      billing_snapshot: {
        legal_name: b.legal_name ?? [c?.first_name, c?.last_name].filter(Boolean).join(' '), legal_form: b.legal_form ?? null, street: b.street ?? null, postal_code: b.postal_code ?? null,
        city: b.city ?? null, country: b.country ?? null, tax_number: b.tax_number ?? null, vat_id: b.vat_id ?? null, billing_email: b.billing_email ?? null, display_name: c?.display_name ?? null,
      },
      adjustment_ids: myAdj.map((a) => a.id),
      lines: myLines.map((l) => ({ conversion_id: l.conversion_id, rule_id: l.rule_id ?? '', rule_version: l.rule_version ?? '', base_cents: l.base_cents, commission_cents: l.commission_cents })),
    };
  });
  const { data, error } = await db().rpc('immo_creator_close_period', { p_period: period, p_actor: actor.ref, p_statements: payload });
  if (error) throw new Error(`Abschluss fehlgeschlagen: ${error.message}`);
  await audit('PERIOD_CLOSED', null, actor, 'SUCCESS', { period, statements: Number(data) || payload.length, clawbacks, carried });
  return { closed: Number(data) || payload.length, clawbacks, carried };
}

// ---------------- Dokumente ----------------
export type StatementRow = {
  id: string; creator_id: string; period: string; status: string; billing_mode: BillingMode; conversions: number; revenue_net_cents: number;
  commission_cents: number; adjustments_cents: number; net_cents: number; vat_rate_bps: number; vat_cents: number; gross_cents: number; payout_cents: number;
  tax_mode: string; tax_note: string; billing_snapshot: Record<string, string | null>; closed_at: string; approved_at: string | null; paid_at: string | null;
};

async function storeDoc(s: StatementRow, docType: 'STATEMENT' | 'INVOICE' | 'CREDIT_NOTE', number: string, bytes: Uint8Array, actorRef: string) {
  const id = randomUUID();
  const path = `docs/${id}/${docType.toLowerCase()}-${number.replace(/[^A-Za-z0-9._-]/g, '-')}.pdf`;
  const up = await db().storage.from(DOC_BUCKET).upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: false });
  if (up.error) throw new Error('Dokument konnte nicht gespeichert werden.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const { data, error } = await db().from('immo_creator_documents').insert({ id, creator_id: s.creator_id, statement_id: s.id, doc_type: docType, number, storage_path: path, sha256,
    totals: { net_cents: s.net_cents, vat_cents: s.vat_cents, gross_cents: s.gross_cents, payout_cents: s.payout_cents }, created_by: actorRef }).select('*').single();
  if (error) { await db().storage.from(DOC_BUCKET).remove([path]); throw new Error(/unique|duplicate/i.test(error.message) ? 'Für diese Abrechnung gibt es bereits ein Dokument dieser Art.' : 'Dokument konnte nicht gespeichert werden.'); }
  return data as { id: string; number: string; storage_path: string };
}

async function statementLines(s: StatementRow): Promise<{ lines: DocLine[]; adj: DocLine[] }> {
  const [com, adj] = await Promise.all([
    db().from('immo_creator_commissions').select('base_cents, commission_cents, immo_creator_conversions(occurred_at, plan, source, campaign_slug)').eq('statement_id', s.id).order('created_at'),
    db().from('immo_creator_adjustments').select('kind, amount_cents, reason').eq('statement_id', s.id),
  ]);
  type C = { base_cents: number; commission_cents: number; immo_creator_conversions: { occurred_at: string; plan: string | null; source: string; campaign_slug: string | null } | null };
  const KIND: Record<string, string> = { BONUS: 'Bonus', CORRECTION: 'Korrektur', CLAWBACK: 'Rückforderung', CARRY_OVER: 'Übertrag' };
  return {
    lines: ((com.data ?? []) as C[]).map((c) => ({
      description: `Provision ${c.immo_creator_conversions ? dDE(c.immo_creator_conversions.occurred_at) : ''} · ${PLAN[c.immo_creator_conversions?.plan ?? ''] ?? c.immo_creator_conversions?.plan ?? 'Kauf'}`,
      detail: `Netto-Umsatz ${eurText(c.base_cents)} · über ${c.immo_creator_conversions?.source === 'code' ? 'Vorteilscode' : 'Creator-Link'}${c.immo_creator_conversions?.campaign_slug ? ` · Kampagne ${c.immo_creator_conversions.campaign_slug}` : ''}`,
      amountCents: c.commission_cents,
    })),
    adj: ((adj.data ?? []) as { kind: string; amount_cents: number; reason: string }[]).map((a) => ({ description: `${KIND[a.kind] ?? a.kind}: ${a.reason}`, amountCents: a.amount_cents })),
  };
}

const creatorParty = (s: StatementRow) => {
  const b = s.billing_snapshot;
  const ids = [b.tax_number ? `Steuernummer ${b.tax_number}` : null, b.vat_id ? `USt-IdNr. ${b.vat_id}` : null].filter(Boolean) as string[];
  return { name: [b.legal_name, b.legal_form].filter(Boolean).join(' ') || 'Creator', lines: [b.street, [b.postal_code, b.city].filter(Boolean).join(' '), b.country && b.country !== 'DE' ? b.country : null].filter(Boolean) as string[], taxIds: ids };
};
const immoParty = () => ({ name: ISSUER.name, lines: [`Inh. ${ISSUER.owner}`, ISSUER.street, ISSUER.city], taxIds: [`USt-IdNr. ${ISSUER.vatId}`] });
const totalsRows = (s: StatementRow): [string, string, boolean?][] => [
  ['Summe netto', eurText(s.net_cents)],
  ...(s.vat_cents ? [[`Umsatzsteuer ${(s.vat_rate_bps / 100).toLocaleString('de-DE')} %`, eurText(s.vat_cents)] as [string, string]] : []),
  ['Gesamtbetrag', eurText(s.gross_cents), true],
];

export async function ensureStatementPdf(s: StatementRow, actorRef: string) {
  const { data: have } = await db().from('immo_creator_documents').select('id, number, storage_path').eq('statement_id', s.id).eq('doc_type', 'STATEMENT').order('version', { ascending: false }).limit(1).maybeSingle();
  if (have) return have as { id: string; number: string; storage_path: string };
  const { lines, adj } = await statementLines(s);
  const number = `AB-${s.period}-${s.creator_id.slice(0, 8)}`;
  const bytes = await renderDoc({
    kind: 'STATEMENT', title: `Creator-Abrechnung ${periodLabel(s.period)}`, number, issueDate: dDE(new Date()), servicePeriod: servicePeriodText(s.period),
    issuer: immoParty(), recipient: creatorParty(s),
    meta: [['Conversions', String(s.conversions)], ['Netto-Umsatz', eurText(s.revenue_net_cents)], ['Verfahren', s.billing_mode === 'CREDIT_NOTE' ? 'Gutschrift' : 'Rechnung des Creators']],
    lines: [...lines, ...adj],
    totals: [['Provision', eurText(s.commission_cents)], ['Anpassungen', eurText(s.adjustments_cents)], ...totalsRows(s), ['Auszahlungsbetrag', eurText(s.payout_cents), true]],
    notes: [s.tax_note, 'Diese Abrechnung ist eine Übersicht und keine Rechnung. Grundlage sind die serverseitig erfassten, bezahlten und nicht erstatteten Käufe.'],
    footer: `ImmoAdv · ${ISSUER.street} · ${ISSUER.city} · Abrechnung ${number}`,
  });
  return storeDoc(s, 'STATEMENT', number, bytes, actorRef);
}

// Rechnung des Creators (vom System vorausgefüllt, vom Creator bestätigt) – Aussteller ist der Creator.
export async function createCreatorInvoice(s: StatementRow, number: string, maskedAccount: string | null, actor: Actor) {
  if (s.billing_mode !== 'INVOICE') throw new Error('Für diese Abrechnung erstellt ImmoAdv eine Gutschrift.');
  if (s.status !== 'READY' || s.payout_cents <= 0) throw new Error('Für diese Abrechnung kann gerade keine Rechnung erstellt werden.');
  const p = creatorParty(s);
  if (s.billing_snapshot.country === 'DE' && !p.taxIds.length) throw new Error('Für eine Rechnung brauchst du eine Steuernummer oder USt-IdNr. Bitte in deinem Profil unter Rechnungsdaten ergänzen und ImmoAdv informieren.');
  const { lines, adj } = await statementLines(s);
  const bytes = await renderDoc({
    kind: 'INVOICE', title: 'Rechnung', number, issueDate: dDE(new Date()), servicePeriod: servicePeriodText(s.period),
    issuer: p, recipient: immoParty(),
    meta: [['Abrechnung', periodLabel(s.period)], ...(maskedAccount ? [['Zahlung an', maskedAccount] as [string, string]] : [])],
    lines: [{ description: `Werbeleistung im ImmoAdv Creator-Partnerprogramm: Provision ${periodLabel(s.period)}`, detail: `${s.conversions} Conversion(s), Netto-Umsatz ${eurText(s.revenue_net_cents)}; Einzelaufstellung in der Creator-Abrechnung`, amountCents: s.commission_cents }, ...adj],
    totals: totalsRows(s),
    notes: [s.tax_note, maskedAccount ? `Zahlung auf das im ImmoAdv Creator-Portal hinterlegte Konto ${maskedAccount}.` : 'Zahlung auf das im ImmoAdv Creator-Portal hinterlegte Konto.', `Positionen: ${lines.length} Provisionszeile(n) gemäß Abrechnung.`],
    footer: `${p.name} · Rechnung ${number} · erstellt im ImmoAdv Creator Hub`,
  });
  const doc = await storeDoc(s, 'INVOICE', number, bytes, actor.ref);
  const { data } = await db().from('immo_creator_statements').update({ status: 'INVOICED' }).eq('id', s.id).eq('status', 'READY').select('id');
  if (!data?.length) throw new Error('Status wurde inzwischen geändert.');
  await audit('INVOICE_CREATED', s.creator_id, actor, 'SUCCESS', { period: s.period, number, gross_cents: s.gross_cents });
  return doc;
}

// Gutschrift durch ImmoAdv (§ 14 Abs. 2 Satz 2 UStG) – fortlaufende ImmoAdv-Nummer.
async function createCreditNote(s: StatementRow, actor: Actor, maskedAccount: string | null) {
  const year = Number(s.period.slice(0, 4));
  const { data: n, error } = await db().rpc('immo_creator_next_number', { p_name: `creator_credit_note_${year}` });
  const seq = Number(n);
  if (error || !seq) throw new Error('Gutschriftnummer konnte nicht vergeben werden. Bitte erneut versuchen.');
  const number = creditNoteNumber(year, seq);
  const { adj } = await statementLines(s);
  const bytes = await renderDoc({
    kind: 'CREDIT_NOTE', title: 'Gutschrift', number, issueDate: dDE(new Date()), servicePeriod: servicePeriodText(s.period),
    issuer: immoParty(), recipient: creatorParty(s),
    meta: [['Abrechnung', periodLabel(s.period)], ...(maskedAccount ? [['Auszahlung an', maskedAccount] as [string, string]] : [])],
    lines: [{ description: `Werbeleistung im ImmoAdv Creator-Partnerprogramm: Provision ${periodLabel(s.period)}`, detail: `${s.conversions} Conversion(s), Netto-Umsatz ${eurText(s.revenue_net_cents)}`, amountCents: s.commission_cents }, ...adj],
    totals: totalsRows(s),
    notes: ['Gutschrift im Sinne von § 14 Abs. 2 Satz 2 UStG.', `Leistender: ${creatorParty(s).name}${creatorParty(s).taxIds.length ? ` (${creatorParty(s).taxIds.join(', ')})` : ''}.`, s.tax_note],
    footer: `ImmoAdv · ${ISSUER.street} · ${ISSUER.city} · Gutschrift ${number}`,
  });
  return storeDoc(s, 'CREDIT_NOTE', number, bytes, actor.ref);
}

// ---------------- Freigabe und Auszahlung ----------------
export async function statementBlockers(s: StatementRow) {
  const f = await factsFor([s.creator_id]);
  const c = f.creators.get(s.creator_id);
  const pay = f.payout.get(s.creator_id) ?? null;
  const { data: inv } = await db().from('immo_creator_documents').select('id').eq('statement_id', s.id).eq('doc_type', 'INVOICE').limit(1);
  const tax: TaxTreatment = { mode: s.tax_mode as TaxTreatment['mode'], rate_bps: s.vat_rate_bps, note: s.tax_note };
  return { list: blockers({ creatorActive: c?.status === 'ACTIVE', payoutStatus: pay?.status ?? null, agreementAccepted: f.accepted.has(s.creator_id), tax, mode: s.billing_mode, hasInvoice: Boolean(inv?.length), payoutCents: s.payout_cents }), pay, creator: c };
}

export async function approveStatement(s: StatementRow, actor: Actor) {
  if (!['READY', 'INVOICED'].includes(s.status)) throw new Error('Diese Abrechnung kann nicht (mehr) freigegeben werden.');
  const b = await statementBlockers(s);
  if (b.list.length) throw Object.assign(new Error('Freigabe gesperrt.'), { blockers: b.list });
  const masked = b.pay ? maskIban(b.pay.iban_country, b.pay.iban_last4) : null;
  if (s.billing_mode === 'CREDIT_NOTE') await createCreditNote(s, actor, masked);
  const now = new Date().toISOString();
  const { data } = await db().from('immo_creator_statements').update({ status: 'APPROVED', approved_at: now, approved_by: actor.ref }).eq('id', s.id).eq('status', s.status).select('id');
  if (!data?.length) throw new Error('Status wurde inzwischen geändert.');
  await db().from('immo_creator_commissions').update({ status: 'APPROVED' }).eq('statement_id', s.id).eq('status', 'PENDING');
  const ins = await db().from('immo_creator_payouts').insert({ statement_id: s.id, creator_id: s.creator_id, amount_cents: s.payout_cents, payout_account_id: b.pay!.id,
    iban_country: b.pay!.iban_country, iban_last4: b.pay!.iban_last4, reference: `ImmoAdv Creator ${periodLabel(s.period)} ${s.id.slice(0, 8)}`, created_by: actor.ref }).select('id').single();
  if (ins.error) throw new Error('Auszahlung konnte nicht angelegt werden.');
  await audit('STATEMENT_APPROVED', s.creator_id, actor, 'SUCCESS', { period: s.period, payout_cents: s.payout_cents });
  if (s.billing_mode === 'INVOICE') await audit('INVOICE_APPROVED', s.creator_id, actor, 'SUCCESS', { period: s.period });
  await audit('PAYOUT_CREATED', s.creator_id, actor, 'SUCCESS', { period: s.period, amount_cents: s.payout_cents });
  return ins.data;
}
