-- Reparerer innlogging: oppretter manglende profiler, fyller auth_email/brukernavn,
-- nullstiller passord for admin/test, og fikser NULL token-felt.
-- Kjør hele filen i Supabase → SQL Editor.

alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  add column if not exists auth_email text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

-- Profiler for brukere som mangler rad (f.eks. opprettet før trigger).
insert into public.profiles (id, full_name, username, auth_email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  case
    when lower(u.email) = 'simen.navjord@gmail.com' then 'administrator'
    when u.email = 'test@arbeidskart.local' then 'test'
    else lower(
      regexp_replace(
        coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
        '[^a-zA-Z0-9]+',
        '',
        'g'
      )
    )
  end,
  u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

update public.profiles p
set auth_email = u.email
from auth.users u
where p.id = u.id
  and (p.auth_email is null or p.auth_email = '');

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

-- Admin-passord: Kristineerbest123
update auth.users
set encrypted_password = crypt('Kristineerbest123', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, ''),
    updated_at = now()
where lower(email) = 'simen.navjord@gmail.com';

-- Test-passord: Test
update auth.users
set encrypted_password = crypt('Test', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, ''),
    updated_at = now()
where email = 'test@arbeidskart.local';

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

  select p.auth_email into result
  from public.profiles p
  where lower(p.auth_email) = lower(v) || '@arbeidskart.local'
  limit 1;

  return result;
end;
$$;

revoke all on function public.email_for_login(text) from public;
grant execute on function public.email_for_login(text) to anon, authenticated;
