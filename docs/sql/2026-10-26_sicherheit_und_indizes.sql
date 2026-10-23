-- Sicherheits- und Performance-Korrekturen aus der Prüfung vom 23.10.2026 (Supabase Advisors + Policy-Prüfung).
-- Anwenden: Supabase → SQL Editor → Inhalt einfügen → Run. Idempotent, läuft in einer Transaktion.
--
-- 1) Zu offene Zugriffsregeln: Auf neun älteren Tabellen durfte jeder angemeldete Nutzer ALLE Zeilen lesen, anlegen
--    (und teils ändern) – auch fremde. Die Tabellen sind derzeit leer und werden von der Website nicht aus dem Browser
--    genutzt (nur der Server mit Service-Schlüssel greift zu, z. B. Kontolöschung). Daher: offene Regeln entfernen,
--    Browser-Rechte entziehen. RLS bleibt aktiv → Standard „kein Zugriff“ für Browser, Server unverändert.
-- 2) Elf doppelte Indizes entfernen (jeweils ein identischer bleibt bestehen).
-- 3) Fehlenden Index für den Fremdschlüssel immo_feedback.account_id anlegen.
begin;

-- 1) Offene Regeln schließen
drop policy if exists authenticated_evidence_insert on public.evidence_refs;
drop policy if exists authenticated_evidence_select on public.evidence_refs;
drop policy if exists immo_audit_auth_insert on public.immo_audit_log;
drop policy if exists immo_audit_auth_select on public.immo_audit_log;
drop policy if exists immo_bank_score_auth_insert on public.immo_bank_ready_scores;
drop policy if exists immo_bank_score_auth_select on public.immo_bank_ready_scores;
drop policy if exists immo_decision_auth_insert on public.immo_decision_scenarios;
drop policy if exists immo_decision_auth_select on public.immo_decision_scenarios;
drop policy if exists immo_stress_auth_insert on public.immo_stress_scenarios;
drop policy if exists immo_stress_auth_select on public.immo_stress_scenarios;
drop policy if exists immo_underwriting_auth_insert on public.immo_underwriting_cases;
drop policy if exists immo_underwriting_auth_select on public.immo_underwriting_cases;
drop policy if exists immo_underwriting_auth_update on public.immo_underwriting_cases;
drop policy if exists immo_veto_auth_insert on public.immo_veto_findings;
drop policy if exists immo_veto_auth_select on public.immo_veto_findings;
drop policy if exists authenticated_properties_insert on public.properties;
drop policy if exists authenticated_properties_select on public.properties;
drop policy if exists authenticated_properties_update on public.properties;
drop policy if exists authenticated_documents_insert on public.property_documents;
drop policy if exists authenticated_documents_select on public.property_documents;

alter table public.evidence_refs enable row level security;
alter table public.immo_audit_log enable row level security;
alter table public.immo_bank_ready_scores enable row level security;
alter table public.immo_decision_scenarios enable row level security;
alter table public.immo_stress_scenarios enable row level security;
alter table public.immo_underwriting_cases enable row level security;
alter table public.immo_veto_findings enable row level security;
alter table public.properties enable row level security;
alter table public.property_documents enable row level security;

revoke all on public.evidence_refs, public.immo_audit_log, public.immo_bank_ready_scores, public.immo_decision_scenarios,
  public.immo_stress_scenarios, public.immo_underwriting_cases, public.immo_veto_findings, public.properties, public.property_documents
  from anon, authenticated;

-- 2) Doppelte Indizes (der jeweils gleichwertige *_id_idx bzw. *_created bleibt)
drop index if exists public.evidence_refs_document_idx;
drop index if exists public.idx_immo_audit_deal;
drop index if exists public.immo_bank_score_property_idx;
drop index if exists public.immo_decision_scenario_property_idx;
drop index if exists public.idx_immo_ingestion_document;
drop index if exists public.idx_immo_documents_deal;
drop index if exists public.idx_seclog_time;
drop index if exists public.immo_stress_case_idx;
drop index if exists public.immo_underwriting_property_idx;
drop index if exists public.idx_immo_veto_deal;
drop index if exists public.immo_veto_property_idx;

-- 3) Index für Fremdschlüssel
create index if not exists immo_feedback_account_id_idx on public.immo_feedback (account_id);

commit;

-- Kontrolle: sollte 0 Zeilen liefern (keine offenen Regeln mehr)
select tablename, policyname from pg_policies
where schemaname = 'public' and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true');
