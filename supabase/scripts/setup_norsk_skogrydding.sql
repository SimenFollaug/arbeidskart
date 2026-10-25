-- Norsk Skogrydding AS – opprett bedrift + bedriftsadmin
-- Kjør hele filen i Supabase → SQL Editor (etter 0014_organizations.sql).
--
-- Oppretter:
--   Bedrift: Norsk Skogrydding AS (25 brukere, plan pro)
--   Admin:   simen.navjord@norskskogrydding.no
--
-- Midlertidig passord (bytt etter første innlogging):
--   NorskSkog2026!
--
-- Brukernavn: simnav (sim + nav)

-- ---------------------------------------------------------------------------
-- 1. Bedrift
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug, max_users, plan)
values (
  '00000000-0000-4000-8000-000000000003',
  'Norsk Skogrydding AS',
  'norsk-skogrydding',
  25,
  'pro'
)
on conflict (slug) do update
set
  name = excluded.name,
  max_users = excluded.max_users,
  plan = excluded.plan,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 2. Auth-bruker (bedriftsadmin)
-- ---------------------------------------------------------------------------
do $$
declare
  org_id uuid := '00000000-0000-4000-8000-000000000003';
  uid uuid;
  admin_email text := 'simen.navjord@norskskogrydding.no';
  admin_password text := 'NorskSkog2026!';
  meta jsonb := jsonb_build_object(
    'organization_id', org_id::text,
    'full_name', 'Simen Navjord'
  );
begin
  select id into uid from auth.users where lower(email) = lower(admin_email);

  if uid is null then
    uid := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid,
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      meta,
      now(),
      now(),
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      uid,
      jsonb_build_object('sub', uid::text, 'email', admin_email),
      'email',
      uid::text,
      now(),
      now(),
      now()
    );
  else
    update auth.users
    set
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || meta,
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
    where id = uid;
  end if;

  -- Profil (trigger kan ha opprettet rad; sørg for riktig org + admin)
  -- Brukernavn: 3 første i fornavn + 3 første i etternavn -> simnav
  insert into public.profiles (id, full_name, username, auth_email, organization_id, is_admin)
  values (uid, 'Simen Navjord', 'simnav', admin_email, org_id, true)
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    username = excluded.username,
    auth_email = excluded.auth_email,
    organization_id = excluded.organization_id,
    is_admin = true;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Verifiser
-- ---------------------------------------------------------------------------
select
  o.name as bedrift,
  o.slug,
  o.max_users,
  o.plan,
  o.is_active,
  p.full_name,
  p.auth_email,
  p.username,
  p.is_admin,
  p.is_super_admin
from public.organizations o
join public.profiles p on p.organization_id = o.id
where o.slug = 'norsk-skogrydding';
