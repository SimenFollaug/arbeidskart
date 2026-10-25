-- Creates a test user you can log in with as: brukernavn "Test", passord "Test".
-- The app maps the username "Test" to the e-mail "test@arbeidskart.local".
-- Run this in the Supabase SQL editor after 0001_init.sql.
--
-- NB: This inserts directly into auth.users to bypass the 6-char minimum
-- password rule. Only use it for a throwaway test/dev account.
--
-- Important: the token columns (confirmation_token, recovery_token, ...) must be
-- set to '' (empty string), NOT left NULL. If they are NULL, GoTrue's sign-in
-- code fails when reading them and returns an empty error that shows up as "{}".

do $$
declare
  uid uuid;
  test_email text := 'test@arbeidskart.local';
begin
  select id into uid from auth.users where email = test_email;

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
      test_email,
      crypt('Test', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Test"}'::jsonb,
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
      jsonb_build_object('sub', uid::text, 'email', test_email),
      'email',
      uid::text,
      now(),
      now(),
      now()
    );
  else
    -- User already exists: fix the password and any NULL token columns.
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
    where id = uid;
  end if;
end $$;
