-- PostGIS systemtabeller: fjern API-tilgang (anon/authenticated)
-- Kjør etter postgis enable (0001_init.sql).
--
-- spatial_ref_sys er PostGIS-referansedata (koordinatsystemer), ikke app-data.
-- Security Advisor flagger RLS fordi tabellen ligger i public, men den eies av
-- supabase_admin — du kan ikke aktivere RLS selv.
--
-- Løsning: fjern tilgang via PostgREST. Arbeidskart bruker ikke disse direkte.

do $$
begin
  revoke all on table public.spatial_ref_sys from anon, authenticated, public;
exception
  when undefined_table then null;
end $$;

do $$
begin
  revoke all on table public.geometry_columns from anon, authenticated, public;
exception
  when undefined_table then null;
end $$;

do $$
begin
  revoke all on table public.geography_columns from anon, authenticated, public;
exception
  when undefined_table then null;
end $$;
