-- Kjør dette hvis 0005 allerede er kjørt, men lagring fortsatt feiler.
-- Gir authenticated-rollen tilgang til tegning-tabellen.

grant select, insert, update, delete on public.map_drawings to authenticated;
grant select on public.map_drawings_with_author to authenticated;
