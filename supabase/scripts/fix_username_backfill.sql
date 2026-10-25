-- Reparer brukernavn-backfill etter duplikat-feil (23505)
-- Kjør i Supabase SQL Editor hvis 0015 feilet midt i backfill.
--
-- Sikrer unike brukernavn per bedrift, én bruker om gangen.

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
  candidate text;
  n int := 2;
begin
  if base is null or trim(base) = '' then
    base := 'bruker';
  end if;

  candidate := base;
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
begin
  return public.allocate_username_base(
    org_id,
    public.username_from_full_name(full_name),
    exclude_user_id
  );
end;
$$;

do $$
declare
  r record;
  legacy_username text;
  new_username text;
begin
  for r in
    select p.id, p.organization_id, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) in ('simen.navjord@gmail.com', 'test@arbeidskart.local')
    order by p.created_at, p.id
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
end $$;

-- Vis resultat
select o.name as bedrift, p.full_name, p.username, u.email
from public.profiles p
join public.organizations o on o.id = p.organization_id
join auth.users u on u.id = p.id
order by o.name, p.username;
