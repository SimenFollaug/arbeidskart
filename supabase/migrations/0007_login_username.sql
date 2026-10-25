-- Brukernavn for innlogging + oppslag av e-post fra brukernavn/e-post.
-- Run in Supabase SQL Editor after 0001_init.sql.

alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

-- Returnerer auth-e-post for innlogging med enten e-post eller brukernavn.
create or replace function public.email_for_login(identifier text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v text := trim(identifier);
  result text;
begin
  if v = '' then
    return null;
  end if;

  -- Ekte e-post (bevar @, normaliser til små bokstaver).
  if position('@' in v) > 0 then
    return lower(v);
  end if;

  -- Profil-brukernavn, f.eks. "Administrator".
  select u.email into result
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(v)
  limit 1;
  if result is not null then
    return result;
  end if;

  -- Legacy testbruker og andre uten @: test -> test@arbeidskart.local
  select email into result
  from auth.users
  where email = lower(v) || '@arbeidskart.local'
  limit 1;
  if result is not null then
    return result;
  end if;

  return lower(v) || '@arbeidskart.local';
end;
$$;

revoke all on function public.email_for_login(text) from public;
grant execute on function public.email_for_login(text) to anon, authenticated;

-- Oppdater profil-trigger slik at nye brukere får brukernavn fra metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))), '')
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      username = coalesce(excluded.username, public.profiles.username);
  return new;
end;
$$;

-- Admin: brukernavn "administrator" (logg inn med det eller e-post).
update public.profiles p
set username = 'administrator'
from auth.users u
where p.id = u.id
  and lower(u.email) = 'simen.navjord@gmail.com'
  and (p.username is null or p.username = '');

-- Testbruker: brukernavn "test".
update public.profiles p
set username = 'test'
from auth.users u
where p.id = u.id
  and u.email = 'test@arbeidskart.local'
  and (p.username is null or p.username = '');
