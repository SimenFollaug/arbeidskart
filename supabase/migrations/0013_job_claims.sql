-- Arbeidskart - claime og kvittere ut jobber (kategori 'arbeid')
-- Run this in the Supabase SQL editor after 0012_visibility_and_roles.sql.
--
-- Gir kommentarer og tegninger i kategorien 'arbeid' en enkel arbeidsflyt:
--   Ledig  -> Tatt (claimed_by)  -> Fullfoert (completed_by)
-- En bruker kan "ta" en ledig jobb, frigi den igjen, eller kvittere den ut.
-- Overgangene skjer via SECURITY DEFINER-funksjoner slik at hvem som helst som
-- SER jobben kan ta den, uten aa aapne opp den vanlige update-policyen (som
-- fortsatt bare lar forfatter/admin endre selve innholdet).

-- ---------------------------------------------------------------------------
-- 1. Kolonner
-- ---------------------------------------------------------------------------
alter table public.comments
  add column if not exists claimed_by uuid references auth.users (id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists completed_by uuid references auth.users (id) on delete set null,
  add column if not exists completed_at timestamptz;

alter table public.map_drawings
  add column if not exists claimed_by uuid references auth.users (id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists completed_by uuid references auth.users (id) on delete set null,
  add column if not exists completed_at timestamptz;

-- ---------------------------------------------------------------------------
-- 1b. Synlighets-hjelpere (brukes av claim-funksjonene under).
--     Opprettes her fordi 0012 bruker is_comment_recipient/is_drawing_recipient
--     direkte i policyene og ikke definerte disse.
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
      and (
        d.audience = 'all'
        or d.user_id = auth.uid()
        or public.is_admin()
        or public.is_drawing_recipient(d.id)
      )
  );
$$;

grant execute on function public.can_see_comment(uuid) to authenticated;
grant execute on function public.can_see_drawing(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. RPC-funksjoner: comments
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
  if c.completed_at is not null then raise exception 'Jobben er fullfoert'; end if;
  if not (c.claimed_by = auth.uid() or public.is_admin()) then
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
  if c.completed_at is not null then raise exception 'Jobben er allerede fullfoert'; end if;
  if c.claimed_by is null then raise exception 'Jobben maa tas foer den kvitteres ut'; end if;
  if not (c.claimed_by = auth.uid() or public.is_admin()) then
    raise exception 'Bare den som har tatt jobben eller admin kan kvittere ut';
  end if;
  update public.comments
    set completed_by = auth.uid(), completed_at = now()
    where id = cid;
end;
$$;

-- Gjenaapne en fullfoert jobb (admin eller den som fullfoerte den).
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
  if not (c.completed_by = auth.uid() or public.is_admin()) then
    raise exception 'Bare den som fullfoerte jobben eller admin kan gjenaapne den';
  end if;
  update public.comments
    set completed_by = null, completed_at = null, claimed_by = null, claimed_at = null
    where id = cid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC-funksjoner: map_drawings
-- ---------------------------------------------------------------------------
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
  if d.completed_at is not null then raise exception 'Jobben er fullfoert'; end if;
  if not (d.claimed_by = auth.uid() or public.is_admin()) then
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
  if d.completed_at is not null then raise exception 'Jobben er allerede fullfoert'; end if;
  if d.claimed_by is null then raise exception 'Jobben maa tas foer den kvitteres ut'; end if;
  if not (d.claimed_by = auth.uid() or public.is_admin()) then
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
  if not (d.completed_by = auth.uid() or public.is_admin()) then
    raise exception 'Bare den som fullfoerte jobben eller admin kan gjenaapne den';
  end if;
  update public.map_drawings
    set completed_by = null, completed_at = null, claimed_by = null, claimed_at = null
    where id = did;
end;
$$;

grant execute on function public.claim_comment(uuid) to authenticated;
grant execute on function public.release_comment(uuid) to authenticated;
grant execute on function public.complete_comment(uuid) to authenticated;
grant execute on function public.reopen_comment(uuid) to authenticated;
grant execute on function public.claim_drawing(uuid) to authenticated;
grant execute on function public.release_drawing(uuid) to authenticated;
grant execute on function public.complete_drawing(uuid) to authenticated;
grant execute on function public.reopen_drawing(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Views: ta med claim/complete-felt + navn
-- ---------------------------------------------------------------------------
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

grant select on public.comments_with_author to authenticated;
grant select on public.map_drawings_with_author to authenticated;
