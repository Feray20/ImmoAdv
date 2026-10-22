-- Tests Creator Hub Phase 4 (Teilerstattungen, Monatsabschluss mit Erstattungen, Benachrichtigungen, Kontoauszug-Import).
-- Voraussetzung: Phase 1–4 angewendet. Läuft in einer Transaktion und wird zurückgerollt.
begin;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a4', 'c4a@test.invalid'), ('00000000-0000-4000-8000-0000000000b4', 'c4b@test.invalid'), ('00000000-0000-4000-8000-0000000000c4', 'k4@test.invalid');
insert into public.immo_creators (id, user_id, status, ref_code) values
  ('10000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a4', 'ACTIVE', 'aaaaaaaaa4'),
  ('10000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b4', 'ACTIVE', 'bbbbbbbbb4');
insert into public.immo_creator_payout_accounts (id, creator_id, holder_name, iban_enc, iban_last4, iban_country, iban_fingerprint, status, confirmed_at)
values ('20000000-0000-4000-8000-0000000000a4', '10000000-0000-4000-8000-0000000000a4', 'Anna', 'v1:A:B:C', '3000', 'DE', repeat('4', 64), 'VERIFIED', now());
-- K1: wird vor dem Abschluss teilweise erstattet; K2: nach dem Abschluss teilweise, dann vollständig; K3: Kauf bei Creator B
insert into public.immo_creator_conversions (id, creator_id, user_id, source, stripe_session_id, stripe_payment_intent, amount_net_cents, occurred_at) values
  ('60000000-0000-4000-8000-0000000000a4', '10000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000c4', 'link', 'cs_p4_1', 'pi_p4_1', 4118, '2026-10-10T10:00:00Z'),
  ('60000000-0000-4000-8000-0000000000b4', '10000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000c4', 'code', 'cs_p4_2', 'pi_p4_2', 4118, '2026-10-12T10:00:00Z'),
  ('60000000-0000-4000-8000-0000000000c4', '10000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000c4', 'link', 'cs_p4_3', 'pi_p4_3', 2437, '2026-10-13T10:00:00Z');

-- Teilerstattung: anteilig netto, idempotent bei wiederholter Zustellung, Conversion bleibt offen
do $$ declare r jsonb; n int; v bigint; begin
  r := public.immo_creator_record_refund('pi_p4_1', 'ch_p4_1', 4900, 2450);
  if (r->0->>'refunded_net_cents')::bigint <> 2059 then raise exception 'FAIL: anteilig %', r; end if;
  perform public.immo_creator_record_refund('pi_p4_1', 'ch_p4_1', 4900, 2450);   -- gleiche Meldung erneut
  select count(*), sum(refunded_net_cents) into n, v from public.immo_creator_refunds where conversion_id = '60000000-0000-4000-8000-0000000000a4';
  if n <> 1 or v <> 2059 then raise exception 'FAIL: doppelt erfasst (% / %)', n, v; end if;
  if (select status from public.immo_creator_conversions where id = '60000000-0000-4000-8000-0000000000a4') <> 'PENDING' then raise exception 'FAIL: Teilerstattung nimmt Conversion zurück'; end if;
  raise notice 'ok: Teilerstattung anteilig und nur einmal erfasst';
end $$;
do $$ begin
  if jsonb_array_length(public.immo_creator_record_refund('pi_unbekannt', null, 4900, 100)) <> 0 then raise exception 'FAIL: unbekannte Zahlung'; end if;
  if jsonb_array_length(public.immo_creator_record_refund('kein-pi', null, 4900, 100)) <> 0 then raise exception 'FAIL: ungültige Kennung'; end if;
  raise notice 'ok: Unbekannte oder ungültige Zahlungen werden ignoriert';
end $$;

-- Erstattungen sind unveränderbar (nur einmal verrechenbar) und nicht löschbar
do $$ begin update public.immo_creator_refunds set refunded_net_cents = 1; raise exception 'FAIL: Erstattung änderbar';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; raise notice 'ok: Erstattungsbeträge unveränderbar'; end $$;
do $$ begin delete from public.immo_creator_refunds; raise exception 'FAIL: Erstattung löschbar';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; raise notice 'ok: Erstattungen nicht löschbar'; end $$;

-- Monatsabschluss markiert die berücksichtigten Erstattungen in derselben Transaktion; falsche Liste → Abbruch
do $$ begin
  perform public.immo_creator_close_period('2026-10', 'test', '[{"creator_id":"10000000-0000-4000-8000-0000000000a4","status":"READY","billing_mode":"INVOICE","conversions":2,"revenue_net_cents":6177,"commission_cents":1236,"adjustments_cents":0,"net_cents":1236,"vat_rate_bps":0,"vat_cents":0,"gross_cents":1236,"payout_cents":1236,"tax_mode":"SMALL_BUSINESS","tax_note":"§ 19","billing_snapshot":{},"adjustment_ids":[],"refund_ids":["00000000-0000-4000-8000-00000000dead"],"lines":[{"conversion_id":"60000000-0000-4000-8000-0000000000a4","rule_id":"","rule_version":"","base_cents":2059,"commission_cents":412},{"conversion_id":"60000000-0000-4000-8000-0000000000b4","rule_id":"","rule_version":"","base_cents":4118,"commission_cents":824}]}]'::jsonb);
  raise exception 'FAIL: unbekannte Erstattung akzeptiert';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; raise notice 'ok: Abschluss prüft die verrechneten Erstattungen'; end $$;
do $$ declare rid uuid; payload jsonb; n int; begin
  select id into rid from public.immo_creator_refunds where conversion_id = '60000000-0000-4000-8000-0000000000a4';
  payload := jsonb_build_array(jsonb_build_object('creator_id','10000000-0000-4000-8000-0000000000a4','status','READY','billing_mode','INVOICE','conversions',2,
    'revenue_net_cents',6177,'commission_cents',1236,'adjustments_cents',0,'net_cents',1236,'vat_rate_bps',0,'vat_cents',0,'gross_cents',1236,'payout_cents',1236,
    'tax_mode','SMALL_BUSINESS','tax_note','§ 19','billing_snapshot','{}'::jsonb,'adjustment_ids','[]'::jsonb,'refund_ids',jsonb_build_array(rid),
    'lines',jsonb_build_array(
      jsonb_build_object('conversion_id','60000000-0000-4000-8000-0000000000a4','rule_id','','rule_version','','base_cents',2059,'commission_cents',412),
      jsonb_build_object('conversion_id','60000000-0000-4000-8000-0000000000b4','rule_id','','rule_version','','base_cents',4118,'commission_cents',824))));
  perform public.immo_creator_close_period('2026-10', 'test', payload);
  select count(*) into n from public.immo_creator_refunds where id = rid and processed_as = 'BASE' and processed_at is not null;
  if n <> 1 then raise exception 'FAIL: Erstattung nicht als verrechnet markiert'; end if;
  raise notice 'ok: Abschluss mit geringerer Grundlage, Erstattung verrechnet';
end $$;
do $$ begin update public.immo_creator_refunds set processed_as = 'IGNORED' where processed_as = 'BASE'; raise exception 'FAIL: Verrechnung änderbar';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; raise notice 'ok: Verrechnete Erstattung bleibt verrechnet'; end $$;

-- Nach dem Abschluss: Teilerstattung, dann Rest → Conversion zurückgenommen, Erstattungen summieren sich zum Netto-Betrag
do $$ declare v bigint; begin
  perform public.immo_creator_record_refund('pi_p4_2', 'ch_p4_2', 4900, 1225);
  perform public.immo_creator_record_refund('pi_p4_2', 'ch_p4_2', 4900, 4900);
  select sum(refunded_net_cents) into v from public.immo_creator_refunds where conversion_id = '60000000-0000-4000-8000-0000000000b4';
  if v <> 4118 then raise exception 'FAIL: Summe der Erstattungen %', v; end if;
  if (select status from public.immo_creator_conversions where id = '60000000-0000-4000-8000-0000000000b4') <> 'REVERSED' then raise exception 'FAIL: nicht zurückgenommen'; end if;
  if jsonb_array_length(public.immo_creator_record_refund('pi_p4_2', 'ch_p4_2', 4900, 4900)) <> 0 then raise exception 'FAIL: zurückgenommene Conversion erneut erfasst'; end if;
  raise notice 'ok: Mehrere Teilerstattungen bis zur vollständigen Rücknahme';
end $$;

-- Benachrichtigungen: einmal setzbar, Beträge bleiben geschützt
update public.immo_creator_statements set notified_at = now() where creator_id = '10000000-0000-4000-8000-0000000000a4';
do $$ begin update public.immo_creator_statements set notified_at = now() + interval '1 day' where creator_id = '10000000-0000-4000-8000-0000000000a4'; raise exception 'FAIL: zweimal benachrichtigt';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; raise notice 'ok: Hinweis wird nur einmal vermerkt'; end $$;
update public.immo_creator_statements set reminded_at = now() where creator_id = '10000000-0000-4000-8000-0000000000a4';
do $$ begin update public.immo_creator_statements set payout_cents = 1, reminded_at = reminded_at where creator_id = '10000000-0000-4000-8000-0000000000a4'; raise exception 'FAIL: Betrag änderbar';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; raise notice 'ok: Abrechnungsbeträge weiterhin unveränderbar'; end $$;

-- Auszahlung mit Bestätigung aus dem Kontoauszug
insert into public.immo_creator_payouts (id, statement_id, creator_id, amount_cents, payout_account_id, iban_country, iban_last4, reference, status, created_by, approved_by, approved_at)
select '80000000-0000-4000-8000-0000000000a4', id, creator_id, payout_cents, '20000000-0000-4000-8000-0000000000a4', 'DE', '3000', 'ImmoAdv Creator 2026-10', 'EXPORTED', 'test', 'test2', now()
from public.immo_creator_statements where creator_id = '10000000-0000-4000-8000-0000000000a4';
do $$ begin update public.immo_creator_payouts set paid_via = 'IRGENDWIE' where id = '80000000-0000-4000-8000-0000000000a4'; raise exception 'FAIL: freie Herkunft';
exception when check_violation then raise notice 'ok: Herkunft der Zahlungsbestätigung geprüft'; end $$;
update public.immo_creator_payouts set status = 'PAID', paid_at = '2026-11-20T12:00:00Z', paid_by = 'test', paid_via = 'BANK_STATEMENT', bank_ref = 'BANK-1' where id = '80000000-0000-4000-8000-0000000000a4';
do $$ begin update public.immo_creator_payouts set bank_ref = 'X' where id = '80000000-0000-4000-8000-0000000000a4'; raise exception 'FAIL: bezahlte Auszahlung änderbar';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; raise notice 'ok: Bezahlte Auszahlung bleibt abgeschlossen'; end $$;

insert into public.immo_creator_bank_imports (file_sha256, statement_id, account_last4, entries, matched, imported_by) values (repeat('a', 64), '2026-11-20-001', '3000', 4, 1, 'test');
do $$ begin insert into public.immo_creator_bank_imports (file_sha256, entries, matched, imported_by) values (repeat('a', 64), 1, 0, 'test'); raise exception 'FAIL: doppelter Import';
exception when unique_violation then raise notice 'ok: Jeder Kontoauszug wird nur einmal vermerkt'; end $$;
do $$ begin delete from public.immo_creator_bank_imports; raise exception 'FAIL: Import löschbar';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; raise notice 'ok: Importe unveränderbar'; end $$;

-- Zugriff: Creator sehen weder Erstattungen noch Importe und können keine Erstattung melden
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);
do $$ begin perform 1 from public.immo_creator_refunds; raise exception 'FAIL: Erstattungen lesbar';
exception when insufficient_privilege then raise notice 'ok: Erstattungen nur Server'; end $$;
do $$ begin perform 1 from public.immo_creator_bank_imports; raise exception 'FAIL: Importe lesbar';
exception when insufficient_privilege then raise notice 'ok: Kontoauszug-Importe nur Server'; end $$;
do $$ begin perform public.immo_creator_record_refund('pi_p4_3', null, 2900, 2900); raise exception 'FAIL: Erstattung durch Nutzer';
exception when insufficient_privilege then raise notice 'ok: Erstattung melden nur Server'; end $$;
do $$ declare n int; begin
  select count(*) into n from public.immo_creator_statements; if n <> 1 then raise exception 'FAIL: A sieht % Abrechnungen', n; end if;
  raise notice 'ok: Creator A sieht weiterhin nur die eigene Abrechnung';
end $$;
reset role;

-- Einstellungen vorhanden, Audit-Ereignisse zugelassen
do $$ begin
  if not exists (select 1 from public.immo_settings where key = 'creator_auto_close' and value = 'false'::jsonb) then raise exception 'FAIL: Automatik nicht standardmäßig aus'; end if;
  insert into public.immo_creator_audit (event_type, creator_id, actor_kind, actor_ref, actor_role, result) values ('REFUND_RECORDED', '10000000-0000-4000-8000-0000000000a4', 'system', 'stripe', 'SYSTEM', 'SUCCESS'),
    ('BANK_STATEMENT_IMPORTED', null, 'admin', 'adm1', 'FINANCE_ADMIN', 'SUCCESS'), ('CREATOR_NOTIFIED', '10000000-0000-4000-8000-0000000000a4', 'system', 'cron', 'SYSTEM', 'SUCCESS'), ('SETTINGS_CHANGED', null, 'admin', 'adm1', 'SUPER_ADMIN', 'SUCCESS');
  raise notice 'ok: Automatik standardmäßig aus, neue Audit-Ereignisse zugelassen';
end $$;

select 'ALL CREATOR HUB PHASE 4 TESTS PASSED' as result;
rollback;
