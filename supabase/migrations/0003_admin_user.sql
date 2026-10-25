-- Creates an admin user you can log in with as:
--   e-post:   Simen.Navjord@gmail.com
--   passord:  Kristineerbest123
--   navn:     Administrator
-- Run this in the Supabase SQL editor after 0001_init.sql.
--
-- NB: This inserts directly into auth.users and marks the e-mail as confirmed,
-- so no confirmation e-mail is sent (avoids the e-mail rate limit).
--
-- Important: the token columns (confirmation_token, recovery_token, ...) must be
-- set to '' (empty string), NOT left NULL. If they are NULL, GoTrue's sign-in
-- code fails when reading them and returns an empty error that shows up as "{}".

do $$
declare
  uid uuid;
  admin_email text := 'simen.navjord@gmail.com';
  admin_password text := 'Kristineerbest123';
begin
  select id into uid from auth.users where email = admin_email;

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
      '{"full_name":"Administrator"}'::jsonb,
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
    -- User already exists: fix the password, name and any NULL token columns.
    update auth.users
    set encrypted_password = crypt(admin_password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = raw_user_meta_data || '{"full_name":"Administrator"}'::jsonb,
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
end $$;
