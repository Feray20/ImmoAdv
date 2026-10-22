-- Rückbau Creator Hub Phase 2. ACHTUNG: entfernt Kampagnen, Assets (Einträge), Vorteile, Inhalte, Zuordnungen und Conversions.
begin;
drop table if exists public.immo_creator_conversions cascade;
drop table if exists public.immo_creator_attributions cascade;
drop table if exists public.immo_creator_content cascade;
drop table if exists public.immo_creator_benefits cascade;
drop table if exists public.immo_creator_assets cascade;
drop table if exists public.immo_creator_campaign_members cascade;
drop table if exists public.immo_creator_campaigns cascade;
drop function if exists public.immo_creator_performance(uuid, timestamptz, timestamptz);
drop function if exists public.immo_creator_campaign_stats(timestamptz, timestamptz);
drop function if exists public.immo_creator_can_see_campaign(uuid, uuid);
drop function if exists public.immo_creator_conversion_guard();
delete from public.immo_settings where key = 'creator_attribution_window_days';
-- Bucket „creator-assets“ bleibt bestehen (Dateien darin ggf. vorher im Supabase-Dashboard leeren).
commit;
