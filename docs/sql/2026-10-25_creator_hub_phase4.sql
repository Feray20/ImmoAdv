-- ImmoAdv Creator Hub – Phase 4: Teilerstattungen, Kontoauszug-Abgleich (camt.053), automatischer Monatsabschluss
-- Voraussetzung: Phase 1–3. Idempotent. Nur Migrationsdatei – vor dem Livegang im Supabase SQL Editor ausführen.
begin;

-- ---------------------------------------------------------------------------
-- 1) Erstattungen je Conversion (auch Teilerstattungen). Eine Zeile je neuem Erstattungsstand von Stripe;
--    refunded_net_cents ist der Zuwachs (netto, anteilig zum Kaufbetrag). Unveränderbar bis auf die Verrechnung.
-- ---------------------------------------------------------------------------
create table if not exists public.immo_creator_refunds (
  id uuid primary key default gen_random_uuid(),
  conversion_id uuid not null references public.immo_creator_conversions(id) on delete restrict,
  creator_id uuid not null references public.immo_creators(id) on delete restrict,
  stripe_charge_id text check (stripe_charge_id is null or stripe_charge_id ~ '^(ch|py)_[A-Za-z0-9_]+$'),
  refunded_total_cents bigint not null check (refunded_total_cents > 0),  -- kumulierter Erstattungsbetrag laut Stripe (brutto)
  refunded_net_cents bigint not null check (refunded_net_cents > 0),      -- Zuwachs netto (Grundlage der Verrechnung)
  full_refund boolean not null default false,
  processed_at timestamptz,
  processed_as text check (processed_as is null or processed_as in ('BASE','CLAWBACK','REVERSED','IGNORED')),
  created_at timestamptz not null default now(),
  unique (conversion_id, refunded_total_cents)
);
create index if not exists immo_creator_refunds_open_idx on public.immo_creator_refunds (conversion_id) where processed_at is null;

create or replace function public.immo_creator_refund_guard() returns trigger language plpgsql set search_path to '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Erstattungen werden nicht gelöscht.'; end if;
  if (to_jsonb(new) - array['processed_at','processed_as']) is distinct from (to_jsonb(old) - array['processed_at','processed_as']) then
    raise exception 'Erstattungen sind unveränderbar.';
  end if;
  if old.processed_at is not null then raise exception 'Erstattung ist bereits verrechnet.'; end if;
  return new;
end $$;
drop trigger if exists immo_creator_refund_guard_trg on public.immo_creator_refunds;
create trigger immo_creator_refund_guard_trg before update or delete on public.immo_creator_refunds
  for each row execute function public.immo_creator_refund_guard();

-- Erstattungsstand aus Stripe übernehmen (Webhook charge.refunded – kommt auch bei Teilerstattungen).
-- Sperrt die Conversion, berechnet den netto-Zuwachs anteilig und nimmt die Conversion bei vollständiger Erstattung zurück.
create or replace function public.immo_creator_record_refund(p_payment_intent text, p_charge text, p_amount bigint, p_refunded bigint)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare c record; total_net bigint; prev bigint; delta bigint; full_r boolean; out jsonb := '[]'::jsonb;
begin
  if p_payment_intent is null or p_payment_intent !~ '^pi_[A-Za-z0-9_]+$' then return out; end if;
  if p_amount is null or p_amount <= 0 or p_refunded is null or p_refunded <= 0 then return out; end if;
  full_r := p_refunded >= p_amount;
  for c in select id, creator_id, amount_net_cents, status from public.immo_creator_conversions
           where stripe_payment_intent = p_payment_intent for update loop
    if c.status = 'REVERSED' then continue; end if;
    total_net := case when full_r then c.amount_net_cents else round(c.amount_net_cents::numeric * p_refunded / p_amount)::bigint end;
    select coalesce(sum(refunded_net_cents), 0) into prev from public.immo_creator_refunds where conversion_id = c.id;
    delta := total_net - prev;
    if delta > 0 then
      insert into public.immo_creator_refunds (conversion_id, creator_id, stripe_charge_id, refunded_total_cents, refunded_net_cents, full_refund)
      values (c.id, c.creator_id, p_charge, p_refunded, delta, full_r)
      on conflict (conversion_id, refunded_total_cents) do nothing;
    end if;
    if full_r then
      update public.immo_creator_conversions set status = 'REVERSED', reversed_at = now() where id = c.id;
    end if;
    out := out || jsonb_build_object('conversion_id', c.id, 'creator_id', c.creator_id, 'refunded_net_cents', greatest(delta, 0), 'full', full_r);
  end loop;
  return out;
end $$;
revoke all on function public.immo_creator_record_refund(text, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.immo_creator_record_refund(text, text, bigint, bigint) to service_role;

-- Monatsabschluss: zusätzlich die beim Abschluss berücksichtigten Erstattungen (geringere Grundlage) in derselben
-- Transaktion als verrechnet markieren. Signatur unverändert; neu ist das optionale Feld refund_ids je Abrechnung.
create or replace function public.immo_creator_close_period(p_period text, p_actor text, p_statements jsonb)
returns integer language plpgsql set search_path to '' as $$
declare s jsonb; l jsonb; sid uuid; n integer := 0; sumc bigint; nref integer;
begin
  if p_period !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'Ungültiger Zeitraum.'; end if;
  perform pg_advisory_xact_lock(hashtext('immo_creator_close:' || p_period));
  for s in select * from jsonb_array_elements(coalesce(p_statements, '[]'::jsonb)) loop
    select coalesce(sum((x->>'commission_cents')::bigint), 0) into sumc from jsonb_array_elements(coalesce(s->'lines', '[]'::jsonb)) x;
    if sumc <> (s->>'commission_cents')::bigint then raise exception 'Summe der Provisionszeilen passt nicht.'; end if;
    if (s->>'net_cents')::bigint <> (s->>'commission_cents')::bigint + (s->>'adjustments_cents')::bigint then raise exception 'Nettobetrag passt nicht.'; end if;
    insert into public.immo_creator_statements (creator_id, period, status, billing_mode, conversions, revenue_net_cents, commission_cents, adjustments_cents,
      net_cents, vat_rate_bps, vat_cents, gross_cents, payout_cents, tax_mode, tax_note, billing_snapshot, closed_by)
    values ((s->>'creator_id')::uuid, p_period, s->>'status', s->>'billing_mode', (s->>'conversions')::int, (s->>'revenue_net_cents')::bigint,
      (s->>'commission_cents')::bigint, (s->>'adjustments_cents')::bigint, (s->>'net_cents')::bigint, (s->>'vat_rate_bps')::int, (s->>'vat_cents')::bigint,
      (s->>'gross_cents')::bigint, (s->>'payout_cents')::bigint, s->>'tax_mode', s->>'tax_note', s->'billing_snapshot', p_actor)
    returning id into sid;
    for l in select * from jsonb_array_elements(coalesce(s->'lines', '[]'::jsonb)) loop
      insert into public.immo_creator_commissions (conversion_id, creator_id, statement_id, period, rule_id, rule_version, base_cents, commission_cents)
      values ((l->>'conversion_id')::uuid, (s->>'creator_id')::uuid, sid, p_period, nullif(l->>'rule_id', '')::uuid, nullif(l->>'rule_version', '')::int,
        (l->>'base_cents')::bigint, (l->>'commission_cents')::bigint);
    end loop;
    update public.immo_creator_adjustments set statement_id = sid
      where id in (select (x#>>'{}')::uuid from jsonb_array_elements(coalesce(s->'adjustment_ids', '[]'::jsonb)) x)
        and creator_id = (s->>'creator_id')::uuid and statement_id is null;
    if (select count(*) from public.immo_creator_adjustments where statement_id = sid) <> jsonb_array_length(coalesce(s->'adjustment_ids', '[]'::jsonb)) then
      raise exception 'Anpassungen wurden inzwischen geändert. Bitte erneut abschließen.';
    end if;
    update public.immo_creator_refunds set processed_at = now(), processed_as = 'BASE'
      where id in (select (x#>>'{}')::uuid from jsonb_array_elements(coalesce(s->'refund_ids', '[]'::jsonb)) x)
        and creator_id = (s->>'creator_id')::uuid and processed_at is null;
    get diagnostics nref = row_count;
    if nref <> jsonb_array_length(coalesce(s->'refund_ids', '[]'::jsonb)) then
      raise exception 'Erstattungen wurden inzwischen geändert. Bitte erneut abschließen.';
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.immo_creator_close_period(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.immo_creator_close_period(text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 2) Benachrichtigungen zur Abrechnung (Hinweis „bereit“ und eine Erinnerung bei fehlender Rechnung)
-- ---------------------------------------------------------------------------
alter table public.immo_creator_statements add column if not exists notified_at timestamptz;
alter table public.immo_creator_statements add column if not exists reminded_at timestamptz;

create or replace function public.immo_creator_statement_guard() returns trigger language plpgsql set search_path to '' as $$
declare ord text[] := array['READY','INVOICED','APPROVED','PAID'];
        free text[] := array['status','approved_at','approved_by','paid_at','carried_over','notified_at','reminded_at'];
begin
  if tg_op = 'DELETE' then raise exception 'Abrechnungen werden nicht gelöscht.'; end if;
  if (to_jsonb(new) - free) is distinct from (to_jsonb(old) - free) then
    raise exception 'Abgeschlossene Abrechnungen sind unveränderbar.';
  end if;
  if old.status = 'ZERO' and new.status <> 'ZERO' then raise exception 'Abrechnung ohne Betrag bleibt abgeschlossen.'; end if;
  if old.status <> 'ZERO' and array_position(ord, new.status) < array_position(ord, old.status) then raise exception 'Status kann nicht zurückgesetzt werden.'; end if;
  if old.carried_over and not new.carried_over then raise exception 'Übertrag ist endgültig.'; end if;
  if old.notified_at is not null and new.notified_at is distinct from old.notified_at then raise exception 'Benachrichtigung ist bereits vermerkt.'; end if;
  if old.reminded_at is not null and new.reminded_at is distinct from old.reminded_at then raise exception 'Erinnerung ist bereits vermerkt.'; end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Kontoauszug-Abgleich: Herkunft der Zahlungsbestätigung und importierte Auszüge
-- ---------------------------------------------------------------------------
alter table public.immo_creator_payouts add column if not exists paid_via text;
alter table public.immo_creator_payouts add column if not exists bank_ref text;
do $$ begin
  alter table public.immo_creator_payouts add constraint immo_creator_payouts_paid_via_check check (paid_via is null or paid_via in ('MANUAL','BANK_STATEMENT'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.immo_creator_payouts add constraint immo_creator_payouts_bank_ref_check check (bank_ref is null or char_length(bank_ref) <= 120);
exception when duplicate_object then null; end $$;

create table if not exists public.immo_creator_bank_imports (
  id uuid primary key default gen_random_uuid(),
  file_sha256 text not null unique check (file_sha256 ~ '^[0-9a-f]{64}$'),
  statement_id text check (statement_id is null or char_length(statement_id) <= 80),
  account_last4 text check (account_last4 is null or account_last4 ~ '^[0-9A-Z]{4}$'),
  entries integer not null check (entries >= 0),
  matched integer not null check (matched >= 0),
  imported_by text not null,
  created_at timestamptz not null default now()
);
create or replace function public.immo_creator_bank_import_immutable() returns trigger language plpgsql set search_path to '' as $$
begin raise exception 'Importierte Kontoauszüge sind unveränderbar.'; end $$;
drop trigger if exists immo_creator_bank_import_no_change on public.immo_creator_bank_imports;
create trigger immo_creator_bank_import_no_change before update or delete on public.immo_creator_bank_imports
  for each row execute function public.immo_creator_bank_import_immutable();

-- Zugriff: nur Server (Service-Rolle); Creator sehen Erstattungen und Importe nicht.
alter table public.immo_creator_refunds enable row level security;
alter table public.immo_creator_bank_imports enable row level security;
revoke all on public.immo_creator_refunds, public.immo_creator_bank_imports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Audit-Ereignisse Phase 4
-- ---------------------------------------------------------------------------
alter table public.immo_creator_audit drop constraint if exists immo_creator_audit_event_type_check;
alter table public.immo_creator_audit add constraint immo_creator_audit_event_type_check check (event_type in (
  'CREATOR_CREATED','APPLICATION_SUBMITTED','REVIEW_STARTED','CREATOR_APPROVED','CREATOR_INFO_REQUESTED','CREATOR_REJECTED',
  'CREATOR_SUSPENDED','CREATOR_REACTIVATED','AGREEMENT_ACCEPTED',
  'BANK_DATA_ADDED','BANK_DATA_CHANGED','BANK_DETAILS_VIEWED','BANK_DATA_VERIFIED',
  'ADMIN_ROLE_CHANGED','ACCESS_DENIED',
  'CAMPAIGN_CHANGED','CAMPAIGN_MEMBERS_CHANGED','ASSET_CHANGED','ASSET_DOWNLOADED','BENEFIT_CHANGED',
  'CONTENT_SUBMITTED','CONTENT_REVIEWED','CONVERSION_RECORDED','CONVERSION_REVERSED',
  'COMMISSION_CHANGED','ADJUSTMENT_CREATED','PERIOD_CLOSED','BILLING_MODE_CHANGED','STATEMENT_APPROVED','DOCUMENT_DOWNLOADED',
  'INVOICE_CREATED','INVOICE_APPROVED','INVOICE_REJECTED','PAYOUT_CREATED','PAYOUT_APPROVED','PAYOUT_EXPORTED','PAYOUT_PAID','PAYOUT_FAILED',
  'CREATOR_ACCOUNT_DELETED',
  'REFUND_RECORDED','BANK_STATEMENT_IMPORTED','CREATOR_NOTIFIED','SETTINGS_CHANGED'
));

-- ---------------------------------------------------------------------------
-- 5) Einstellungen
-- ---------------------------------------------------------------------------
insert into public.immo_settings (key, value, updated_by) values
  ('creator_auto_close', 'false'::jsonb, 'migration:creator_hub_phase4'),
  ('creator_invoice_reminder_days', '7'::jsonb, 'migration:creator_hub_phase4')
on conflict (key) do nothing;

commit;
