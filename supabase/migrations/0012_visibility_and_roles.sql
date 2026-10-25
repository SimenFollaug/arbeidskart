-- Arbeidskart - synlighet (mottakere) og admin-rolle
-- Run this in the Supabase SQL editor after the earlier migrations.
--
-- Innfører:
--  * profiles.is_admin  - admin ser og styrer alt
--  * audience ('all' | 'selected') på comments og map_drawings
--  * koblingstabeller comment_recipients / drawing_recipients
--  * RLS: elementer delt med 'selected' er kun synlige for forfatter,
--    valgte mottakere og admin. Redigering/sletting: forfatter eller admin.

-- ---------------------------------------------------------------------------
-- 1. Admin-flagg på profil
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. audience-kolonner
-- ---------------------------------------------------------------------------
alter table public.comments
  add column if not exists audience text not null default 'all'
  check (audience in ('all', 'selected'));

alter table public.map_drawings
  add column if not exists audience text not null default 'all'
  check (audience in ('all', 'selected'));

-- ---------------------------------------------------------------------------
-- 3. Koblingstabeller for mottakere
-- ---------------------------------------------------------------------------
create table if not exists public.comment_recipients (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (comment_id, user_id)
);

create table if not exists public.drawing_recipients (
  drawing_id uuid not null references public.map_drawings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (drawing_id, user_id)
);

create index if not exists comment_recipients_user_idx
  on public.comment_recipients (user_id);
create index if not exists drawing_recipients_user_idx
  on public.drawing_recipients (user_id);

alter table public.comment_recipients enable row level security;
alter table public.drawing_recipients enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Hjelpefunksjoner (SECURITY DEFINER for å unngå RLS-rekursjon)
-- ---------------------------------------------------------------------------
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

create or replace function public.is_comment_recipient(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.comment_recipients r
    where r.comment_id = cid and r.user_id = auth.uid()
  );
$$;

create or replace function public.is_drawing_recipient(did uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.drawing_recipients r
    where r.drawing_id = did and r.user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_comment_recipient(uuid) to authenticated;
grant execute on function public.is_drawing_recipient(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS: comments
-- ---------------------------------------------------------------------------
drop policy if exists "Comments are readable by authenticated users" on public.comments;
drop policy if exists "Comments visible to audience" on public.comments;
create policy "Comments visible to audience"
  on public.comments for select
  to authenticated
  using (
    audience = 'all'
    or user_id = auth.uid()
    or public.is_admin()
    or public.is_comment_recipient(id)
  );

drop policy if exists "Users can update their own comments" on public.comments;
drop policy if exists "Author or admin can update comments" on public.comments;
create policy "Author or admin can update comments"
  on public.comments for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can delete their own comments" on public.comments;
drop policy if exists "Authenticated users can delete any comment" on public.comments;
drop policy if exists "Author or admin can delete comments" on public.comments;
create policy "Author or admin can delete comments"
  on public.comments for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. RLS: map_drawings
-- ---------------------------------------------------------------------------
drop policy if exists "Drawings readable by authenticated users" on public.map_drawings;
drop policy if exists "Drawings visible to audience" on public.map_drawings;
create policy "Drawings visible to audience"
  on public.map_drawings for select
  to authenticated
  using (
    audience = 'all'
    or user_id = auth.uid()
    or public.is_admin()
    or public.is_drawing_recipient(id)
  );

drop policy if exists "Users can update their own drawings" on public.map_drawings;
drop policy if exists "Author or admin can update drawings" on public.map_drawings;
create policy "Author or admin can update drawings"
  on public.map_drawings for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can delete their own drawings" on public.map_drawings;
drop policy if exists "Authenticated users can delete any drawing" on public.map_drawings;
drop policy if exists "Author or admin can delete drawings" on public.map_drawings;
create policy "Author or admin can delete drawings"
  on public.map_drawings for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. RLS: recipient-tabeller
-- ---------------------------------------------------------------------------
-- SELECT: mottakeren selv, admin, eller den som eier foreldre-elementet.
drop policy if exists "Comment recipients readable" on public.comment_recipients;
create policy "Comment recipients readable"
  on public.comment_recipients for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.comments c
      where c.id = comment_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Comment owner or admin manages recipients (insert)" on public.comment_recipients;
create policy "Comment owner or admin manages recipients (insert)"
  on public.comment_recipients for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.comments c
      where c.id = comment_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Comment owner or admin manages recipients (delete)" on public.comment_recipients;
create policy "Comment owner or admin manages recipients (delete)"
  on public.comment_recipients for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.comments c
      where c.id = comment_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Drawing recipients readable" on public.drawing_recipients;
create policy "Drawing recipients readable"
  on public.drawing_recipients for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.map_drawings d
      where d.id = drawing_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Drawing owner or admin manages recipients (insert)" on public.drawing_recipients;
create policy "Drawing owner or admin manages recipients (insert)"
  on public.drawing_recipients for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.map_drawings d
      where d.id = drawing_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Drawing owner or admin manages recipients (delete)" on public.drawing_recipients;
create policy "Drawing owner or admin manages recipients (delete)"
  on public.drawing_recipients for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.map_drawings d
      where d.id = drawing_id and d.user_id = auth.uid()
    )
  );

grant select, insert, delete on public.comment_recipients to authenticated;
grant select, insert, delete on public.drawing_recipients to authenticated;

-- ---------------------------------------------------------------------------
-- 8. profiles: admin kan endre alle profiler; hindre selv-promotering
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Hindre at en vanlig bruker setter is_admin på seg selv via egen-profil-policyen.
create or replace function public.guard_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Blokker kun innloggede vanlige brukere som prøver å endre admin-status.
  -- SQL Editor / service-rollen har auth.uid() = NULL og får sette første admin.
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Kun administratorer kan endre admin-status';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_is_admin on public.profiles;
create trigger profiles_guard_is_admin
  before update on public.profiles
  for each row execute function public.guard_is_admin();

-- ---------------------------------------------------------------------------
-- 9. Views: ta med audience + aggregerte mottakere
-- ---------------------------------------------------------------------------
-- Vi dropper viewene først: create or replace tillater ikke å sette inn en ny
-- kolonne (audience) midt i en eksisterende view.
drop view if exists public.comments_with_author;
drop view if exists public.map_drawings_with_author;

create or replace view public.comments_with_author
with (security_invoker = true) as
  select
    c.id,
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
    p.full_name as author_name,
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
  left join public.profiles p on p.id = c.user_id;

create or replace view public.map_drawings_with_author
with (security_invoker = true) as
  select
    d.id,
    d.user_id,
    d.title,
    d.body,
    d.category,
    d.drawing_type,
    d.geojson,
    d.created_at,
    d.updated_at,
    d.audience,
    p.full_name as author_name,
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
  left join public.profiles p on p.id = d.user_id;

grant select on public.comments_with_author to authenticated;
grant select on public.map_drawings_with_author to authenticated;

-- ---------------------------------------------------------------------------
-- 10. deleted_comments: kun admin eller opprinnelig forfatter kan se arkivet
-- ---------------------------------------------------------------------------
drop policy if exists "Deleted comments readable by authenticated users" on public.deleted_comments;
drop policy if exists "Deleted comments visible to admin or author" on public.deleted_comments;
create policy "Deleted comments visible to admin or author"
  on public.deleted_comments for select
  to authenticated
  using (public.is_admin() or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 11. Realtime for delingsendringer
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.comment_recipients;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.drawing_recipients;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 12. Bootstrap: gjør din første admin (kjør denne linjen manuelt ved behov)
-- ---------------------------------------------------------------------------
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'simen.navjord@gmail.com');
