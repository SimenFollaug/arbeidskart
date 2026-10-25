-- Forbedrer brukernavn-innlogging: lagrer auth-e-post på profil (unngår auth.users-join)
-- og matcher også visningsnavn (full_name). Kjør etter 0007_login_username.sql.

alter table public.profiles
  add column if not exists auth_email text;

-- Fyll inn e-post fra auth.users (kjøres én gang).
update public.profiles p
set auth_email = u.email
from auth.users u
where p.id = u.id
  and (p.auth_email is null or p.auth_email = '');

-- Sett brukernavn fra visningsnavn der det mangler.
update public.profiles
set username = lower(regexp_replace(trim(full_name), '[^a-zA-Z0-9]+', '', 'g'))
where (username is null or username = '')
  and full_name is not null
  and trim(full_name) <> '';

-- Admin og test (idempotent).
update public.profiles p
set username = 'administrator'
from auth.users u
where p.id = u.id
  and lower(u.email) = 'simen.navjord@gmail.com';

update public.profiles p
set username = 'test'
from auth.users u
where p.id = u.id
  and u.email = 'test@arbeidskart.local';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, auth_email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))), ''),
    new.email
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      username = coalesce(excluded.username, public.profiles.username),
      auth_email = excluded.auth_email;
  return new;
end;
$$;

create or replace function public.email_for_login(identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := trim(identifier);
  result text;
begin
  if v = '' then
    return null;
  end if;

  if position('@' in v) > 0 then
    return lower(v);
  end if;

  -- Brukernavn eller visningsnavn, f.eks. "administrator" eller "Administrator".
  select p.auth_email into result
  from public.profiles p
  where p.auth_email is not null
    and (
      lower(p.username) = lower(v)
      or lower(p.full_name) = lower(v)
    )
  limit 1;
  if result is not null then
    return result;
  end if;

  -- Legacy: test -> test@arbeidskart.local
  select p.auth_email into result
  from public.profiles p
  where lower(p.auth_email) = lower(v) || '@arbeidskart.local'
  limit 1;
  if result is not null then
    return result;
  end if;

  return null;
end;
$$;

revoke all on function public.email_for_login(text) from public;
grant execute on function public.email_for_login(text) to anon, authenticated;
