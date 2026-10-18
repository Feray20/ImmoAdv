-- Modul-Freischaltung je Unternehmenskonto (Web-Admin → Partner → Aktionen → Module freischalten).
-- {"kreditmappe":"on"|"off", ...}; fehlender Schlüssel = laut Tarif.
alter table public.immo_b2b_accounts add column if not exists modules jsonb not null default '{}'::jsonb;
alter table public.immo_b2b_accounts drop constraint if exists immo_b2b_accounts_modules_obj;
alter table public.immo_b2b_accounts add constraint immo_b2b_accounts_modules_obj check (jsonb_typeof(modules) = 'object');
