// ImmoAdv Card – Service-Schicht (nur Server). Die Oberfläche spricht ausschließlich über /api/karten mit diesem Modul.
// Alle schreibenden Vorgänge prüfen Anmeldung, Eigentum und Produktstatus serverseitig; Freigaben laufen über die
// atomaren SQL-Funktionen (immo_card_authorize/settle/refund). Fehlen die Tabellen noch, gilt „nicht eingerichtet“.
import { randomUUID } from 'node:crypto';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { available, limitAllowed, type CardStatus, type LimitState } from './limits';
import { programStatus } from './status';
import { benefitFor } from './benefits';

export type CardView = {
  id: string; type: 'debit' | 'charge'; design: string; status: CardStatus; last4: string | null; isDemo: boolean;
  limit: { monthly: number; settled: number; reserved: number; refunded: number; deposit: number; available: number; resetAt: string } | null;
};
export const NOT_ACTIVE_MSG = 'Diese Funktion ist derzeit noch nicht aktiviert. Ihre Daten wurden nicht verändert.';
const missingTable = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || '')));
export const programActive = () => ['LIVE', 'SANDBOX'].includes(programStatus());

type LimitRow = { card_id: string; monthly_limit_cents: number; settled_cents: number; reserved_cents: number; refunded_cents: number; security_deposit_cents: number; refunds_release_limit: boolean; reset_at: string };
type CardRow = { id: string; type: 'debit' | 'charge'; design: string; status: CardStatus; last4: string | null; is_demo: boolean; created_at: string };
const toState = (l: LimitRow): LimitState => ({ monthlyLimit: Number(l.monthly_limit_cents), settled: Number(l.settled_cents), reserved: Number(l.reserved_cents), refunded: Number(l.refunded_cents), securityDeposit: Number(l.security_deposit_cents), refundsReleaseLimit: l.refunds_release_limit });

// Übersicht für den angemeldeten Nutzer: nur eigene Karten; in Produktion nie Demo-Karten.
export async function overview(userId: string) {
  const empty = { cards: [] as CardView[], transactions: [] as unknown[], tablesReady: false, benefit: benefitFor([], programActive()) };
  if (!adminConfigured()) return empty;
  const db = supabaseAdmin();
  const { data: cards, error } = await db.from('immo_cards').select('id, type, design, status, last4, is_demo, created_at').eq('user_id', userId).order('created_at');
  if (error) { if (!missingTable(error)) console.warn('[karten] overview', error.code); return empty; }
  const real = (cards as CardRow[] ?? []).filter((c) => !c.is_demo || process.env.VERCEL_ENV !== 'production');
  const ids = real.map((c) => c.id);
  const [{ data: limits }, { data: tx }] = ids.length
    ? await Promise.all([
      db.from('immo_card_limits').select('*').in('card_id', ids),
      db.from('immo_card_transactions').select('id, card_id, kind, amount_cents, status, merchant, category, available_before_cents, available_after_cents, created_at').in('card_id', ids).order('created_at', { ascending: false }).limit(100),
    ])
    : [{ data: [] }, { data: [] }];
  const byCard = new Map((limits as LimitRow[] ?? []).map((l) => [l.card_id, l]));
  const view: CardView[] = real.map((c) => {
    const l = byCard.get(c.id);
    const s = l ? toState(l) : null;
    return { id: c.id, type: c.type, design: c.design, status: c.status, last4: c.last4, isDemo: c.is_demo,
      limit: l && s ? { monthly: s.monthlyLimit, settled: s.settled, reserved: s.reserved, refunded: s.refunded, deposit: s.securityDeposit, available: available(s), resetAt: l.reset_at } : null };
  });
  return { cards: view, transactions: tx ?? [], tablesReady: true, benefit: benefitFor(real, programActive()) };
}

async function ownCard(userId: string, cardId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db.from('immo_cards').select('id, user_id, type, status, is_demo').eq('id', cardId).maybeSingle();
  if (error || !data || data.user_id !== userId) return null;
  return data as { id: string; user_id: string; type: 'debit' | 'charge'; status: CardStatus; is_demo: boolean };
}

async function audit(cardId: string | null, userId: string | null, action: string, oldValue: unknown, newValue: unknown, ipHash: string | null) {
  await supabaseAdmin().from('immo_card_audit').insert({ card_id: cardId, user_id: userId, actor: userId ? 'user' : 'system', action, old_value: oldValue ?? null, new_value: newValue ?? null, ip_hash: ipHash, request_id: randomUUID() });
}

export type ActionResult = { ok: true; data?: unknown } | { ok: false; status: number; error: string; code?: string };

export async function updateLimit(userId: string, cardId: string, newLimit: number, ipHash: string | null): Promise<ActionResult> {
  if (!programActive() || !adminConfigured()) return { ok: false, status: 503, error: NOT_ACTIVE_MSG, code: 'NOT_CONFIGURED' };
  const card = await ownCard(userId, cardId);
  if (!card) return { ok: false, status: 404, error: 'Karte nicht gefunden.' };
  if (card.status === 'BLOCKED') return { ok: false, status: 409, error: 'Die Karte ist gesperrt. Das Limit kann nicht geändert werden.' };
  const db = supabaseAdmin();
  const { data: l } = await db.from('immo_card_limits').select('*').eq('card_id', cardId).maybeSingle();
  if (!l) return { ok: false, status: 409, error: 'Für diese Karte ist noch kein Limit eingerichtet.' };
  const chk = limitAllowed(card.type, newLimit, Number((l as LimitRow).security_deposit_cents));
  if (!chk.ok) return { ok: false, status: 400, error: chk.reason };
  const { error } = await db.from('immo_card_limits').update({ monthly_limit_cents: newLimit, updated_at: new Date().toISOString() }).eq('card_id', cardId);
  if (error) { console.warn('[karten] limit', error.code); return { ok: false, status: 502, error: 'Die Änderung konnte momentan nicht übernommen werden. Bitte versuchen Sie es erneut.' }; }
  await audit(cardId, userId, 'limit_change', { monthly_limit_cents: (l as LimitRow).monthly_limit_cents }, { monthly_limit_cents: newLimit }, ipHash);
  return { ok: true };
}

export async function setFrozen(userId: string, cardId: string, on: boolean, ipHash: string | null): Promise<ActionResult> {
  if (!programActive() || !adminConfigured()) return { ok: false, status: 503, error: NOT_ACTIVE_MSG, code: 'NOT_CONFIGURED' };
  const card = await ownCard(userId, cardId);
  if (!card) return { ok: false, status: 404, error: 'Karte nicht gefunden.' };
  if (card.status === 'BLOCKED') return { ok: false, status: 409, error: 'Die Karte ist dauerhaft gesperrt.' };
  if (!on && card.status !== 'FROZEN') return { ok: true };
  if (on && card.status !== 'ACTIVE') return { ok: false, status: 409, error: 'Nur aktive Karten können vorübergehend gesperrt werden.' };
  const { cardProvider } = await import('./provider');
  const p = await cardProvider().freeze(cardId, on);
  if (!p.ok && !card.is_demo) return { ok: false, status: 503, error: p.message, code: p.code };
  const next: CardStatus = on ? 'FROZEN' : 'ACTIVE';
  const { error } = await supabaseAdmin().from('immo_cards').update({ status: next, updated_at: new Date().toISOString() }).eq('id', cardId).eq('user_id', userId);
  if (error) return { ok: false, status: 502, error: 'Die Änderung konnte momentan nicht übernommen werden. Bitte versuchen Sie es erneut.' };
  await audit(cardId, userId, on ? 'card_freeze' : 'card_unfreeze', { status: card.status }, { status: next }, ipHash);
  return { ok: true, data: { status: next } };
}

// Autorisierung durch den Kartenherausgeber (Webhook). Atomar in der Datenbank; doppelte Anfragen gleicher ID werden nicht doppelt belastet.
export async function authorizeTransaction(input: { cardId: string; amountCents: number; idempotencyKey: string; merchant?: string; category?: string }): Promise<ActionResult> {
  if (!programActive() || !adminConfigured()) return { ok: false, status: 503, error: NOT_ACTIVE_MSG, code: 'NOT_CONFIGURED' };
  const { data, error } = await supabaseAdmin().rpc('immo_card_authorize', { p_card: input.cardId, p_amount: input.amountCents, p_key: input.idempotencyKey, p_merchant: input.merchant ?? null, p_category: input.category ?? null });
  if (error) {
    if (missingTable(error)) return { ok: false, status: 503, error: NOT_ACTIVE_MSG, code: 'NOT_CONFIGURED' };
    const code = /invalid_amount|invalid_idempotency_key/.test(error.message) ? 400 : /card_not_found/.test(error.message) ? 404 : 502;
    return { ok: false, status: code, error: code === 502 ? 'Autorisierung derzeit nicht möglich.' : error.message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, data: { status: row?.status, transactionId: row?.tx_id, availableAfterCents: row?.available_after_cents } };
}
