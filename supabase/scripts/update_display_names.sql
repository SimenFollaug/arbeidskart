-- Oppdater visningsnavn (Display Name) for brukere.
-- Supabase-dashboardet viser primært raw_user_meta_data->>'name' som Display Name.
-- Kjør i Supabase → SQL Editor.

-- 1) Diagnostikk – vis nåværende navn for aktuelle brukere
select
  u.id,
  u.email,
  p.auth_email,
  p.username,
  u.raw_user_meta_data ->> 'name' as meta_name,
  u.raw_user_meta_data ->> 'full_name' as meta_full_name,
  p.full_name as profile_full_name
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) in (
      'laagenhans@gmail.com',
      'oysteinsemb@hotmail.com',
      'simen.navjord@gmail.com'
    )
   or u.email ilike '%semb%'
   or u.email ilike '%oystein%'
   or coalesce(p.auth_email, '') ilike '%semb%'
order by u.email;

-- 2) Oppdater visningsnavn (beholder is_admin og username uendret)
do $$
declare
  r record;
  uid uuid;
begin
  for r in
    select *
    from (values
      ('laagenhans@gmail.com', 'Hans Martin Utklev', false),
      ('Oysteinsemb@hotmail.com', 'Øystein Semb', true),
      ('simen.navjord@gmail.com', 'Simen Navjord', false)
    ) as t(email, full_name, fuzzy_match)
  loop
    uid := null;

    if r.fuzzy_match then
      select u.id into uid
      from auth.users u
      left join public.profiles p on p.id = u.id
      where lower(u.email) = lower(r.email)
         or u.email ilike '%semb%hotmail%'
         or coalesce(p.auth_email, '') ilike '%semb%hotmail%'
      order by
        case when lower(u.email) = lower(r.email) then 0 else 1 end,
        u.created_at
      limit 1;
    else
      select u.id into uid
      from auth.users u
      where lower(u.email) = lower(r.email)
      limit 1;
    end if;

    if uid is null then
      raise warning 'Fant ingen bruker for %', r.email;
      continue;
    end if;

    update auth.users
    set
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'name', r.full_name,
          'full_name', r.full_name,
          'display_name', r.full_name
        ),
      updated_at = now()
    where id = uid;

    update public.profiles p
    set
      full_name = r.full_name,
      auth_email = coalesce(p.auth_email, (select email from auth.users where id = uid)),
      username = coalesce(
        p.username,
        public.allocate_username(p.organization_id, r.full_name, p.id)
      )
    where p.id = uid;

    if not found then
      insert into public.profiles (id, full_name, auth_email, organization_id)
      select
        u.id,
        r.full_name,
        u.email,
        nullif(u.raw_user_meta_data ->> 'organization_id', '')::uuid
      from auth.users u
      where u.id = uid
      on conflict (id) do update
      set full_name = excluded.full_name,
          auth_email = coalesce(public.profiles.auth_email, excluded.auth_email);
    end if;

    raise notice 'Oppdatert % → % (id=%)', r.email, r.full_name, uid;
  end loop;
end $$;

-- 3) Kontroll
select
  u.email,
  u.raw_user_meta_data ->> 'name' as display_name,
  u.raw_user_meta_data ->> 'full_name' as full_name,
  p.full_name as profile_full_name,
  p.username
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) in (
      'laagenhans@gmail.com',
      'oysteinsemb@hotmail.com',
      'simen.navjord@gmail.com'
    )
   or u.email ilike '%semb%hotmail%'
order by u.email;
