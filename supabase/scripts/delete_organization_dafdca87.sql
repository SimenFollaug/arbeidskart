-- Slett bedrift (org) og all tilhørende data
-- Kjør i Supabase → SQL Editor.
--
-- Org-id: dafdca87-1c21-4beb-b45c-a9319f598497
--
-- ADVARSEL: Sletter kommentarer, tegninger, brukere og innlogging
-- for alle som tilhører denne bedriften. Kan ikke angres.

do $$
declare
  org_id uuid := 'dafdca87-1c21-4beb-b45c-a9319f598497';
  org_name text;
  user_ids uuid[];
begin
  select name into org_name
  from public.organizations
  where id = org_id;

  if org_name is null then
    raise exception 'Fant ingen bedrift med id %', org_id;
  end if;

  raise notice 'Sletter bedrift: % (%)', org_name, org_id;

  select array_agg(p.id) into user_ids
  from public.profiles p
  where p.organization_id = org_id;

  -- Kartdata (rekkefølge pga. foreign keys uten cascade til org)
  delete from public.comment_recipients
  where comment_id in (
    select id from public.comments where organization_id = org_id
  );

  delete from public.drawing_recipients
  where drawing_id in (
    select id from public.map_drawings where organization_id = org_id
  );

  delete from public.comment_photos
  where organization_id = org_id;

  delete from public.comments
  where organization_id = org_id;

  delete from public.map_drawings
  where organization_id = org_id;

  delete from public.deleted_comments
  where organization_id = org_id;

  -- Auth-brukere (sletter også profiles via cascade)
  if user_ids is not null then
    delete from auth.users where id = any(user_ids);
  end if;

  delete from public.organizations
  where id = org_id;

  raise notice 'Bedrift % er slettet.', org_name;
end $$;

-- Verifiser at den er borte
select id, name from public.organizations
where id = 'dafdca87-1c21-4beb-b45c-a9319f598497';
