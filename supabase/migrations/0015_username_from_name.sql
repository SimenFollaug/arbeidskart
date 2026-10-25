-- Arbeidskart - brukernavn fra fornavn + etternavn (3 + 3 bokstaver)
-- Kjør etter 0014_organizations.sql.
--
-- Eksempel: "Simen Navjord" -> simnav
--           "Anne Marie Hansen" -> annhan
-- Ved navnekonflikt i samme bedrift: simnav2, simnav3, ...

-- ---------------------------------------------------------------------------
-- 1. Hjelpefunksjoner
-- ---------------------------------------------------------------------------
create or replace function public.normalize_name_part(part text)
returns text
language sql
immutable
as $$
  select lower(
    translate(
      regexp_replace(coalesce(part, ''), '[^a-zA-ZæøåÆØÅ]', '', 'g'),
      'æøåÆØÅ',
      'aoaAOA'
    )
  );
$$;

create or replace function public.username_from_full_name(full_name text)
returns text
language plpgsql
immutable
as $$
declare
  parts text[];
  fornavn text;
  etternavn text;
  f3 text;
  l3 text;
  n int;
begin
  if full_name is null or trim(full_name) = '' then
    return null;
  end if;

  parts := regexp_split_to_array(trim(full_name), '\s+');
  n := coalesce(array_length(parts, 1), 0);
  if n = 0 then
    return null;
  end if;

  fornavn := public.normalize_name_part(parts[1]);
  if n > 1 then
    etternavn := public.normalize_name_part(parts[n]);
  else
    etternavn := fornavn;
  end if;

  f3 := left(fornavn, 3);
  l3 := left(etternavn, 3);

  if f3 is null or f3 = '' then
    return null;
  end if;
  if l3 is null or l3 = '' then
    l3 := f3;
  end if;

  return f3 || l3;
end;
$$;

create or replace function public.allocate_username_base(
  org_id uuid,
  base text,
  exclude_user_id uuid default null
)
returns text
language plpgsql
stable
as $$
declare
  candidate text := base;
  n int := 2;
begin
  if base is null or trim(base) = '' then
    base := 'bruker';
    candidate := base;
  end if;

  while exists (
    select 1
    from public.profiles p
    where p.organization_id = org_id
      and lower(p.username) = lower(candidate)
      and (exclude_user_id is null or p.id <> exclude_user_id)
  ) loop
    candidate := base || n::text;
    n := n + 1;
  end loop;

  return candidate;
end;
$$;

create or replace function public.allocate_username(
  org_id uuid,
  full_name text,
  exclude_user_id uuid default null
)
returns text
language plpgsql
stable
as $$
declare
  base text;
begin
  base := public.username_from_full_name(full_name);
  return public.allocate_username_base(org_id, base, exclude_user_id);
end;
$$;

grant execute on function public.normalize_name_part(text) to authenticated;
grant execute on function public.username_from_full_name(text) to authenticated;
grant execute on function public.allocate_username(uuid, text, uuid) to authenticated;
grant execute on function public.allocate_username_base(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. handle_new_user: generer brukernavn automatisk
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
  default_org uuid := '00000000-0000-4000-8000-000000000001';
  full_name_val text;
  username_val text;
begin
  org := coalesce(
    nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid,
    default_org
  );

  full_name_val := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  username_val := coalesce(
    nullif(lower(trim(new.raw_user_meta_data ->> 'username')), ''),
    public.allocate_username(org, full_name_val, new.id)
  );

  insert into public.profiles (id, full_name, username, auth_email, organization_id)
  values (
    new.id,
    full_name_val,
    username_val,
    new.email,
    org
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    auth_email = coalesce(excluded.auth_email, public.profiles.auth_email),
    organization_id = coalesce(public.profiles.organization_id, excluded.organization_id),
    username = coalesce(public.profiles.username, excluded.username);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Backfill: én rad om gangen (unngår duplikat i samme UPDATE-setning)
-- ---------------------------------------------------------------------------
create or replace function public.backfill_profile_usernames()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  legacy_username text;
  new_username text;
begin
  for r in
    select p.id, p.organization_id, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = 'simen.navjord@gmail.com'
       or u.email = 'test@arbeidskart.local'
  loop
    legacy_username := case
      when lower(r.email) = 'simen.navjord@gmail.com' then 'administrator'
      else 'test'
    end;

    new_username := public.allocate_username_base(
      r.organization_id, legacy_username, r.id
    );
    update public.profiles set username = new_username where id = r.id;
  end loop;

  -- Alle andre: 3+3 fra full_name
  for r in
    select p.id, p.organization_id, p.full_name, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) not in ('simen.navjord@gmail.com', 'test@arbeidskart.local')
      and p.full_name is not null
      and trim(p.full_name) <> ''
    order by p.organization_id, p.created_at, p.id
  loop
    new_username := public.allocate_username(r.organization_id, r.full_name, r.id);
    update public.profiles set username = new_username where id = r.id;
  end loop;
end;
$$;

select public.backfill_profile_usernames();

drop function public.backfill_profile_usernames();
