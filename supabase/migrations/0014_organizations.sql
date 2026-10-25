-- Arbeidskart - multi-tenant organisasjoner (bedriftsisolasjon)
-- Run after 0013_job_claims.sql.
--
-- Hver bedrift (organization) har isolert data. RLS sikrer at brukere kun ser
-- data innen egen organization_id. is_admin er org-admin; is_super_admin er
-- plattform-eier.

-- ---------------------------------------------------------------------------
-- 1. organizations
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  max_users int not null default 15,
  plan text not null default 'basis',
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ---------------------------------------------------------------------------
-- 2. organization_id på profiler og tenant-tabeller (nullable først)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists organization_id uuid references public.organizations (id),
  add column if not exists is_super_admin boolean not null default false;

alter table public.comments
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.map_drawings
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.deleted_comments
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.comment_photos
  add column if not exists organization_id uuid references public.organizations (id);

-- ---------------------------------------------------------------------------
-- 3. Backfill: default-org for eksisterende data
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug, plan)
values (
  '00000000-0000-4000-8000-000000000001',
  'Pilot / Intern',
  'pilot-intern',
  'basis'
)
on conflict (slug) do nothing;

update public.profiles
set organization_id = '00000000-0000-4000-8000-000000000001'
where organization_id is null;

update public.comments
set organization_id = '00000000-0000-4000-8000-000000000001'
where organization_id is null;

update public.map_drawings
set organization_id = '00000000-0000-4000-8000-000000000001'
where organization_id is null;

update public.deleted_comments
set organization_id = '00000000-0000-4000-8000-000000000001'
where organization_id is null;

update public.comment_photos cp
set organization_id = c.organization_id
from public.comments c
where cp.comment_id = c.id
  and cp.organization_id is null;

update public.comment_photos
set organization_id = '00000000-0000-4000-8000-000000000001'
where organization_id is null;

-- NOT NULL etter backfill
alter table public.profiles
  alter column organization_id set not null;

alter table public.comments
  alter column organization_id set not null;

alter table public.map_drawings
  alter column organization_id set not null;

alter table public.deleted_comments
  alter column organization_id set not null;

alter table public.comment_photos
  alter column organization_id set not null;

create index if not exists comments_organization_created_idx
  on public.comments (organization_id, created_at desc);

create index if not exists map_drawings_organization_created_idx
  on public.map_drawings (organization_id, created_at desc);

create index if not exists profiles_organization_idx
  on public.profiles (organization_id);

-- Brukernavn unikt per org (ikke globalt)
drop index if exists public.profiles_username_lower_idx;
create unique index if not exists profiles_username_lower_idx
  on public.profiles (organization_id, lower(username))
  where username is not null;

-- ---------------------------------------------------------------------------
-- 4. Hjelpefunksjoner
-- ---------------------------------------------------------------------------
create or replace function public.current_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_org_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin() and not public.is_super_admin()
     or public.is_super_admin();
$$;

create or replace function public.same_organization(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
    or org_id = public.current_organization_id();
$$;

create or replace function public.org_access_allowed()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.organizations o
      join public.profiles p on p.organization_id = o.id
      where p.id = auth.uid()
        and o.is_active = true
    );
$$;

create or replace function public.storage_path_org_id(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
    else null
  end;
$$;

grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_org_admin() to authenticated;
grant execute on function public.same_organization(uuid) to authenticated;
grant execute on function public.org_access_allowed() to authenticated;
grant execute on function public.storage_path_org_id(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Triggere: sett organization_id automatisk
-- ---------------------------------------------------------------------------
create or replace function public.set_row_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare org uuid;
begin
  if new.organization_id is not null then
    return new;
  end if;
  select organization_id into org from public.profiles where id = auth.uid();
  if org is null then
    raise exception 'Brukeren tilhører ingen bedrift';
  end if;
  new.organization_id := org;
  return new;
end;
$$;

drop trigger if exists comments_set_organization on public.comments;
create trigger comments_set_organization
  before insert on public.comments
  for each row execute function public.set_row_organization_id();

drop trigger if exists map_drawings_set_organization on public.map_drawings;
create trigger map_drawings_set_organization
  before insert on public.map_drawings
  for each row execute function public.set_row_organization_id();

create or replace function public.set_photo_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare org uuid;
begin
  if new.organization_id is not null then
    return new;
  end if;
  select organization_id into org
  from public.comments
  where id = new.comment_id;
  if org is null then
    select organization_id into org from public.profiles where id = auth.uid();
  end if;
  if org is null then
    raise exception 'Kunne ikke bestemme bedrift for bilde';
  end if;
  new.organization_id := org;
  return new;
end;
$$;

drop trigger if exists comment_photos_set_organization on public.comment_photos;
create trigger comment_photos_set_organization
  before insert on public.comment_photos
  for each row execute function public.set_photo_organization_id();

-- Arkiver slettede kommentarer med organization_id
create or replace function public.archive_deleted_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.deleted_comments (
    comment_id, user_id, title, body, category, status,
    lat, lng, created_at, updated_at, deleted_by, deleted_at,
    organization_id
  ) values (
    old.id, old.user_id, old.title, old.body, old.category, old.status,
    old.lat, old.lng, old.created_at, old.updated_at, auth.uid(), now(),
    old.organization_id
  );
  return old;
end;
$$;

-- Valider at mottakere er i samme org
create or replace function public.validate_recipient_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare parent_org uuid;
declare recipient_org uuid;
begin
  if tg_table_name = 'comment_recipients' then
    select organization_id into parent_org
    from public.comments where id = new.comment_id;
  else
    select organization_id into parent_org
    from public.map_drawings where id = new.drawing_id;
  end if;

  select organization_id into recipient_org
  from public.profiles where id = new.user_id;

  if parent_org is null or recipient_org is null or parent_org <> recipient_org then
    raise exception 'Mottaker må tilhøre samme bedrift';
  end if;
  return new;
end;
$$;

drop trigger if exists comment_recipients_validate_org on public.comment_recipients;
create trigger comment_recipients_validate_org
  before insert on public.comment_recipients
  for each row execute function public.validate_recipient_same_org();

drop trigger if exists drawing_recipients_validate_org on public.drawing_recipients;
create trigger drawing_recipients_validate_org
  before insert on public.drawing_recipients
  for each row execute function public.validate_recipient_same_org();

-- Hindre at vanlige brukere endrer organization_id / is_super_admin
create or replace function public.guard_profile_org_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin()
     and not public.is_super_admin() then
    raise exception 'Kun administratorer kan endre admin-status';
  end if;

  if new.is_super_admin is distinct from old.is_super_admin
     and auth.uid() is not null
     and not public.is_super_admin() then
    raise exception 'Kun plattform-administrator kan endre super-admin-status';
  end if;

  if new.organization_id is distinct from old.organization_id
     and auth.uid() is not null
     and not public.is_super_admin() then
    raise exception 'Kun plattform-administrator kan flytte brukere mellom bedrifter';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_is_admin on public.profiles;
drop trigger if exists profiles_guard_profile_org on public.profiles;
create trigger profiles_guard_profile_org
  before update on public.profiles
  for each row execute function public.guard_profile_org_fields();

-- Oppdater handle_new_user: krever organization_id i metadata eller default-org
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
  default_org uuid := '00000000-0000-4000-8000-000000000001';
begin
  org := coalesce(
    nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid,
    default_org
  );

  insert into public.profiles (id, full_name, organization_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    org
  )
  on conflict (id) do update
    set organization_id = coalesce(public.profiles.organization_id, excluded.organization_id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. can_see_* med org-filter
-- ---------------------------------------------------------------------------
create or replace function public.can_see_comment(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.comments c
    where c.id = cid
      and public.same_organization(c.organization_id)
      and public.org_access_allowed()
      and (
        c.audience = 'all'
        or c.user_id = auth.uid()
        or public.is_admin()
        or public.is_comment_recipient(c.id)
      )
  );
$$;

create or replace function public.can_see_drawing(did uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.map_drawings d
    where d.id = did
      and public.same_organization(d.organization_id)
      and public.org_access_allowed()
      and (
        d.audience = 'all'
        or d.user_id = auth.uid()
        or public.is_admin()
        or public.is_drawing_recipient(d.id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC jobber: org-sjekk (SECURITY DEFINER omgår RLS)
-- ---------------------------------------------------------------------------
create or replace function public.claim_comment(cid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c public.comments;
begin
  select * into c from public.comments where id = cid;
  if not found then raise exception 'Fant ikke kommentaren'; end if;
  if not public.same_organization(c.organization_id) then raise exception 'Ingen tilgang'; end if;
  if not public.org_access_allowed() then raise exception 'Bedriften er deaktivert'; end if;
  if not public.can_see_comment(cid) then raise exception 'Ingen tilgang til denne jobben'; end if;
  if c.category <> 'arbeid' then raise exception 'Bare arbeid kan tas'; end if;
  if c.completed_at is not null then raise exception 'Jobben er allerede fullfoert'; end if;
  if c.claimed_by is not null then raise exception 'Jobben er allerede tatt'; end if;
  update public.comments
    set claimed_by = auth.uid(), claimed_at = now()
    where id = cid;
end;
$$;

create or replace function public.release_comment(cid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c public.comments;
begin
  select * into c from public.comments where id = cid;
  if not found then raise exception 'Fant ikke kommentaren'; end if;
  if not public.same_organization(c.organization_id) then raise exception 'Ingen tilgang'; end if;
  if c.completed_at is not null then raise exception 'Jobben er fullfoert'; end if;
  if not (c.claimed_by = auth.uid() or public.is_admin() or public.is_super_admin()) then
    raise exception 'Bare den som har tatt jobben eller admin kan frigi den';
  end if;
  update public.comments
    set claimed_by = null, claimed_at = null
    where id = cid;
end;
$$;

create or replace function public.complete_comment(cid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c public.comments;
begin
  select * into c from public.comments where id = cid;
  if not found then raise exception 'Fant ikke kommentaren'; end if;
  if not public.same_organization(c.organization_id) then raise exception 'Ingen tilgang'; end if;
  if c.completed_at is not null then raise exception 'Jobben er allerede fullfoert'; end if;
  if c.claimed_by is null then raise exception 'Jobben maa tas foer den kvitteres ut'; end if;
  if not (c.claimed_by = auth.uid() or public.is_admin() or public.is_super_admin()) then
    raise exception 'Bare den som har tatt jobben eller admin kan kvittere ut';
  end if;
  update public.comments
    set completed_by = auth.uid(), completed_at = now()
    where id = cid;
end;
$$;

create or replace function public.reopen_comment(cid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c public.comments;
begin
  select * into c from public.comments where id = cid;
  if not found then raise exception 'Fant ikke kommentaren'; end if;
  if not public.same_organization(c.organization_id) then raise exception 'Ingen tilgang'; end if;
  if not (c.completed_by = auth.uid() or public.is_admin() or public.is_super_admin()) then
    raise exception 'Bare den som fullfoerte jobben eller admin kan gjenaapne den';
  end if;
  update public.comments
    set completed_by = null, completed_at = null, claimed_by = null, claimed_at = null
    where id = cid;
end;
$$;

create or replace function public.claim_drawing(did uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d public.map_drawings;
begin
  select * into d from public.map_drawings where id = did;
  if not found then raise exception 'Fant ikke tegningen'; end if;
  if not public.same_organization(d.organization_id) then raise exception 'Ingen tilgang'; end if;
  if not public.org_access_allowed() then raise exception 'Bedriften er deaktivert'; end if;
  if not public.can_see_drawing(did) then raise exception 'Ingen tilgang til denne jobben'; end if;
  if d.category <> 'arbeid' then raise exception 'Bare arbeid kan tas'; end if;
  if d.completed_at is not null then raise exception 'Jobben er allerede fullfoert'; end if;
  if d.claimed_by is not null then raise exception 'Jobben er allerede tatt'; end if;
  update public.map_drawings
    set claimed_by = auth.uid(), claimed_at = now()
    where id = did;
end;
$$;

create or replace function public.release_drawing(did uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d public.map_drawings;
begin
  select * into d from public.map_drawings where id = did;
  if not found then raise exception 'Fant ikke tegningen'; end if;
  if not public.same_organization(d.organization_id) then raise exception 'Ingen tilgang'; end if;
  if d.completed_at is not null then raise exception 'Jobben er fullfoert'; end if;
  if not (d.claimed_by = auth.uid() or public.is_admin() or public.is_super_admin()) then
    raise exception 'Bare den som har tatt jobben eller admin kan frigi den';
  end if;
  update public.map_drawings
    set claimed_by = null, claimed_at = null
    where id = did;
end;
$$;

create or replace function public.complete_drawing(did uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d public.map_drawings;
begin
  select * into d from public.map_drawings where id = did;
  if not found then raise exception 'Fant ikke tegningen'; end if;
  if not public.same_organization(d.organization_id) then raise exception 'Ingen tilgang'; end if;
  if d.completed_at is not null then raise exception 'Jobben er allerede fullfoert'; end if;
  if d.claimed_by is null then raise exception 'Jobben maa tas foer den kvitteres ut'; end if;
  if not (d.claimed_by = auth.uid() or public.is_admin() or public.is_super_admin()) then
    raise exception 'Bare den som har tatt jobben eller admin kan kvittere ut';
  end if;
  update public.map_drawings
    set completed_by = auth.uid(), completed_at = now()
    where id = did;
end;
$$;

create or replace function public.reopen_drawing(did uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d public.map_drawings;
begin
  select * into d from public.map_drawings where id = did;
  if not found then raise exception 'Fant ikke tegningen'; end if;
  if not public.same_organization(d.organization_id) then raise exception 'Ingen tilgang'; end if;
  if not (d.completed_by = auth.uid() or public.is_admin() or public.is_super_admin()) then
    raise exception 'Bare den som fullfoerte jobben eller admin kan gjenaapne den';
  end if;
  update public.map_drawings
    set completed_by = null, completed_at = null, claimed_by = null, claimed_at = null
    where id = did;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RLS: organizations
-- ---------------------------------------------------------------------------
drop policy if exists "Org members can read their organization" on public.organizations;
create policy "Org members can read their organization"
  on public.organizations for select
  to authenticated
  using (
    id = public.current_organization_id()
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- 9. RLS: profiles
-- ---------------------------------------------------------------------------
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
drop policy if exists "Profiles visible within organization" on public.profiles;
create policy "Profiles visible within organization"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or (public.same_organization(organization_id) and public.org_access_allowed())
    or public.is_super_admin()
  );

drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins can update any profile" on public.profiles;
drop policy if exists "Org admins can update profiles in their org" on public.profiles;
create policy "Org admins can update profiles in their org"
  on public.profiles for update
  to authenticated
  using (
    (public.is_admin() and public.same_organization(organization_id))
    or public.is_super_admin()
  )
  with check (
    (public.is_admin() and public.same_organization(organization_id))
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- 10. RLS: comments
-- ---------------------------------------------------------------------------
drop policy if exists "Comments visible to audience" on public.comments;
create policy "Comments visible to audience"
  on public.comments for select
  to authenticated
  using (
    public.same_organization(organization_id)
    and public.org_access_allowed()
    and (
      audience = 'all'
      or user_id = auth.uid()
      or public.is_admin()
      or public.is_comment_recipient(id)
    )
  );

drop policy if exists "Users can create their own comments" on public.comments;
drop policy if exists "Users can create comments in their org" on public.comments;
create policy "Users can create comments in their org"
  on public.comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.org_access_allowed()
    and (organization_id = public.current_organization_id() or organization_id is null)
  );

drop policy if exists "Author or admin can update comments" on public.comments;
create policy "Author or admin can update comments"
  on public.comments for update
  to authenticated
  using (
    public.same_organization(organization_id)
    and public.org_access_allowed()
    and (user_id = auth.uid() or public.is_admin())
  )
  with check (
    public.same_organization(organization_id)
    and (user_id = auth.uid() or public.is_admin())
  );

drop policy if exists "Author or admin can delete comments" on public.comments;
create policy "Author or admin can delete comments"
  on public.comments for delete
  to authenticated
  using (
    public.same_organization(organization_id)
    and public.org_access_allowed()
    and (user_id = auth.uid() or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- 11. RLS: map_drawings
-- ---------------------------------------------------------------------------
drop policy if exists "Drawings visible to audience" on public.map_drawings;
create policy "Drawings visible to audience"
  on public.map_drawings for select
  to authenticated
  using (
    public.same_organization(organization_id)
    and public.org_access_allowed()
    and (
      audience = 'all'
      or user_id = auth.uid()
      or public.is_admin()
      or public.is_drawing_recipient(id)
    )
  );

drop policy if exists "Users can create their own drawings" on public.map_drawings;
drop policy if exists "Users can create drawings in their org" on public.map_drawings;
create policy "Users can create drawings in their org"
  on public.map_drawings for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.org_access_allowed()
    and (organization_id = public.current_organization_id() or organization_id is null)
  );

drop policy if exists "Author or admin can update drawings" on public.map_drawings;
create policy "Author or admin can update drawings"
  on public.map_drawings for update
  to authenticated
  using (
    public.same_organization(organization_id)
    and public.org_access_allowed()
    and (user_id = auth.uid() or public.is_admin())
  )
  with check (
    public.same_organization(organization_id)
    and (user_id = auth.uid() or public.is_admin())
  );

drop policy if exists "Author or admin can delete drawings" on public.map_drawings;
create policy "Author or admin can delete drawings"
  on public.map_drawings for delete
  to authenticated
  using (
    public.same_organization(organization_id)
    and public.org_access_allowed()
    and (user_id = auth.uid() or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- 12. RLS: deleted_comments
-- ---------------------------------------------------------------------------
drop policy if exists "Deleted comments visible to admin or author" on public.deleted_comments;
create policy "Deleted comments visible to admin or author"
  on public.deleted_comments for select
  to authenticated
  using (
    public.same_organization(organization_id)
    and public.org_access_allowed()
    and (public.is_admin() or user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 13. RLS: comment_photos
-- ---------------------------------------------------------------------------
drop policy if exists "Photos are readable by authenticated users" on public.comment_photos;
drop policy if exists "Photos readable within organization" on public.comment_photos;
create policy "Photos readable within organization"
  on public.comment_photos for select
  to authenticated
  using (
    public.same_organization(organization_id)
    and public.org_access_allowed()
  );

drop policy if exists "Users manage their own photos" on public.comment_photos;
drop policy if exists "Users manage photos in their org" on public.comment_photos;
create policy "Users manage photos in their org"
  on public.comment_photos for all
  to authenticated
  using (
    public.same_organization(organization_id)
    and public.org_access_allowed()
    and auth.uid() = user_id
  )
  with check (
    public.org_access_allowed()
    and auth.uid() = user_id
    and (organization_id = public.current_organization_id() or organization_id is null)
  );

-- ---------------------------------------------------------------------------
-- 14. RLS: recipient-tabeller (org via parent + validate trigger)
-- ---------------------------------------------------------------------------
drop policy if exists "Comment recipients readable" on public.comment_recipients;
create policy "Comment recipients readable"
  on public.comment_recipients for select
  to authenticated
  using (
    public.org_access_allowed()
    and (
      user_id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.comments c
        where c.id = comment_id
          and c.user_id = auth.uid()
          and public.same_organization(c.organization_id)
      )
    )
  );

drop policy if exists "Comment owner or admin manages recipients (insert)" on public.comment_recipients;
create policy "Comment owner or admin manages recipients (insert)"
  on public.comment_recipients for insert
  to authenticated
  with check (
    public.org_access_allowed()
    and (
      public.is_admin()
      or exists (
        select 1 from public.comments c
        where c.id = comment_id
          and c.user_id = auth.uid()
          and public.same_organization(c.organization_id)
      )
    )
  );

drop policy if exists "Comment owner or admin manages recipients (delete)" on public.comment_recipients;
create policy "Comment owner or admin manages recipients (delete)"
  on public.comment_recipients for delete
  to authenticated
  using (
    public.org_access_allowed()
    and (
      public.is_admin()
      or exists (
        select 1 from public.comments c
        where c.id = comment_id
          and c.user_id = auth.uid()
          and public.same_organization(c.organization_id)
      )
    )
  );

drop policy if exists "Drawing recipients readable" on public.drawing_recipients;
create policy "Drawing recipients readable"
  on public.drawing_recipients for select
  to authenticated
  using (
    public.org_access_allowed()
    and (
      user_id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.map_drawings d
        where d.id = drawing_id
          and d.user_id = auth.uid()
          and public.same_organization(d.organization_id)
      )
    )
  );

drop policy if exists "Drawing owner or admin manages recipients (insert)" on public.drawing_recipients;
create policy "Drawing owner or admin manages recipients (insert)"
  on public.drawing_recipients for insert
  to authenticated
  with check (
    public.org_access_allowed()
    and (
      public.is_admin()
      or exists (
        select 1 from public.map_drawings d
        where d.id = drawing_id
          and d.user_id = auth.uid()
          and public.same_organization(d.organization_id)
      )
    )
  );

drop policy if exists "Drawing owner or admin manages recipients (delete)" on public.drawing_recipients;
create policy "Drawing owner or admin manages recipients (delete)"
  on public.drawing_recipients for delete
  to authenticated
  using (
    public.org_access_allowed()
    and (
      public.is_admin()
      or exists (
        select 1 from public.map_drawings d
        where d.id = drawing_id
          and d.user_id = auth.uid()
          and public.same_organization(d.organization_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 15. Views med organization_id
-- ---------------------------------------------------------------------------
drop view if exists public.comments_with_author;
drop view if exists public.map_drawings_with_author;
drop view if exists public.deleted_comments_with_authors;

create or replace view public.comments_with_author
with (security_invoker = true) as
  select
    c.id,
    c.organization_id,
    c.user_id,
    c.title,
    c.body,
    c.category,
    c.status,
    c.lat,
    c.lng,
    c.created_at,
    c.updated_at,
    c.audience,
    c.claimed_by,
    c.claimed_at,
    c.completed_by,
    c.completed_at,
    p.full_name as author_name,
    pc.full_name as claimed_by_name,
    pf.full_name as completed_by_name,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', r.user_id, 'name', rp.full_name)
          order by rp.full_name
        )
        from public.comment_recipients r
        left join public.profiles rp on rp.id = r.user_id
        where r.comment_id = c.id
      ),
      '[]'::jsonb
    ) as recipients
  from public.comments c
  left join public.profiles p on p.id = c.user_id
  left join public.profiles pc on pc.id = c.claimed_by
  left join public.profiles pf on pf.id = c.completed_by;

create or replace view public.map_drawings_with_author
with (security_invoker = true) as
  select
    d.id,
    d.organization_id,
    d.user_id,
    d.title,
    d.body,
    d.category,
    d.drawing_type,
    d.geojson,
    d.created_at,
    d.updated_at,
    d.audience,
    d.claimed_by,
    d.claimed_at,
    d.completed_by,
    d.completed_at,
    p.full_name as author_name,
    pc.full_name as claimed_by_name,
    pf.full_name as completed_by_name,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', r.user_id, 'name', rp.full_name)
          order by rp.full_name
        )
        from public.drawing_recipients r
        left join public.profiles rp on rp.id = r.user_id
        where r.drawing_id = d.id
      ),
      '[]'::jsonb
    ) as recipients
  from public.map_drawings d
  left join public.profiles p on p.id = d.user_id
  left join public.profiles pc on pc.id = d.claimed_by
  left join public.profiles pf on pf.id = d.completed_by;

create or replace view public.deleted_comments_with_authors
with (security_invoker = true) as
  select
    d.id,
    d.organization_id,
    d.comment_id,
    d.user_id,
    d.title,
    d.body,
    d.category,
    d.status,
    d.lat,
    d.lng,
    d.created_at,
    d.updated_at,
    d.deleted_by,
    d.deleted_at,
    pa.full_name as author_name,
    pd.full_name as deleted_by_name
  from public.deleted_comments d
  left join public.profiles pa on pa.id = d.user_id
  left join public.profiles pd on pd.id = d.deleted_by;

grant select on public.comments_with_author to authenticated;
grant select on public.map_drawings_with_author to authenticated;
grant select on public.deleted_comments_with_authors to authenticated;

-- ---------------------------------------------------------------------------
-- 16. Storage: private bucket med org-prefiks i path
-- ---------------------------------------------------------------------------
update storage.buckets
set public = false
where id = 'comment-photos';

drop policy if exists "Photos are publicly readable" on storage.objects;
drop policy if exists "Org members can read photos" on storage.objects;
create policy "Org members can read photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'comment-photos'
    and (
      public.storage_path_org_id(name) = public.current_organization_id()
      -- Legacy paths: {user_id}/{comment_id}/… before multi-tenant
      or split_part(name, '/', 1) = auth.uid()::text
      or public.is_super_admin()
    )
  );

drop policy if exists "Authenticated users can upload photos" on storage.objects;
drop policy if exists "Org members can upload photos" on storage.objects;
create policy "Org members can upload photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'comment-photos'
    and public.org_access_allowed()
    and public.storage_path_org_id(name) = public.current_organization_id()
  );

drop policy if exists "Users can delete their own photos" on storage.objects;
drop policy if exists "Org members can delete their photos" on storage.objects;
create policy "Org members can delete their photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'comment-photos'
    and (
      public.storage_path_org_id(name) = public.current_organization_id()
      or public.is_super_admin()
    )
    and owner = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 18. Innlogging: brukernavn må være entydig på tvers av bedrifter
-- ---------------------------------------------------------------------------
create or replace function public.email_for_login(identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := trim(identifier);
  result text;
  match_count int;
begin
  if v = '' then
    return null;
  end if;

  if position('@' in v) > 0 then
    return lower(v);
  end if;

  select count(*) into match_count
  from public.profiles p
  where p.auth_email is not null
    and (
      lower(p.username) = lower(v)
      or lower(p.full_name) = lower(v)
    );

  if match_count > 1 then
    return null;
  end if;

  if match_count = 1 then
    select p.auth_email into result
    from public.profiles p
    where p.auth_email is not null
      and (
        lower(p.username) = lower(v)
        or lower(p.full_name) = lower(v)
      )
    limit 1;
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

-- ---------------------------------------------------------------------------
-- 17. Bootstrap super-admin (kjør manuelt etter migrasjon ved behov)
-- ---------------------------------------------------------------------------
-- update public.profiles set is_super_admin = true, is_admin = true
--   where id = (select id from auth.users where lower(email) = 'simen.navjord@gmail.com');
