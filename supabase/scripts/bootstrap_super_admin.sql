-- Arbeidskart - super-admin bootstrap og testbedrifter
-- Kjør manuelt i Supabase SQL Editor ETTER 0014_organizations.sql.
--
-- Steg 1: Gjør deg selv til plattform-admin
-- Steg 2: Opprett en ekstra testbedrift med brukere (valgfritt)

-- ---------------------------------------------------------------------------
-- 1. Super-admin (plattform-eier)
-- ---------------------------------------------------------------------------
update public.profiles
set is_super_admin = true,
    is_admin = true
where id = (
  select id from auth.users where lower(email) = 'simen.navjord@gmail.com'
);

-- ---------------------------------------------------------------------------
-- 2. Opprett testbedrift B (eksempel)
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug, max_users, plan)
values (
  '00000000-0000-4000-8000-000000000002',
  'Testbedrift B',
  'testbedrift-b',
  15,
  'basis'
)
on conflict (slug) do nothing;

-- Opprett auth-bruker for bedrift B i Dashboard → Authentication → Users,
-- deretter kjør (bytt id):
--
-- update public.profiles
-- set organization_id = '00000000-0000-4000-8000-000000000002',
--     is_admin = true,
--     full_name = 'Admin B'
-- where id = '<auth-user-uuid>';
--
-- Eller ved opprettelse via Admin API, sett metadata:
--   { "organization_id": "00000000-0000-4000-8000-000000000002", "full_name": "Admin B" }

-- ---------------------------------------------------------------------------
-- 3. Verifiser isolasjon
-- ---------------------------------------------------------------------------
-- select o.name, count(p.id) as users
-- from public.organizations o
-- left join public.profiles p on p.organization_id = o.id
-- group by o.id, o.name;
--
-- select organization_id, count(*) from public.comments group by 1;

-- ---------------------------------------------------------------------------
-- 4. Deaktiver en bedrift (blokkerer tilgang via org_access_allowed)
-- ---------------------------------------------------------------------------
-- update public.organizations set is_active = false where slug = 'testbedrift-b';
