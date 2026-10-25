-- Arbeidskart - arkiv for slettede kommentarer
-- Run this in the Supabase SQL editor after 0001_init.sql.
--
-- Når en kommentar slettes, kopieres den automatisk til
-- public.deleted_comments sammen med hvem som slettet den (auth.uid())
-- og når. Selve slettingen i appen fungerer som før – arkiveringen skjer
-- i en BEFORE DELETE-trigger på databasenivå, så ingenting går tapt.

create table if not exists public.deleted_comments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null,
  user_id uuid,                 -- opprinnelig forfatter
  title text not null,
  body text,
  category text not null,
  status text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null,   -- opprinnelig opprettet
  updated_at timestamptz,
  deleted_by uuid,              -- hvem som slettet (auth.uid())
  deleted_at timestamptz not null default now()
);

create index if not exists deleted_comments_deleted_at_idx
  on public.deleted_comments (deleted_at desc);

alter table public.deleted_comments enable row level security;

-- Lesbar for innloggede brukere. Innsetting skjer kun via triggeren under
-- (security definer), så vi trenger ingen insert-policy for vanlige brukere.
drop policy if exists "Deleted comments readable by authenticated users" on public.deleted_comments;
create policy "Deleted comments readable by authenticated users"
  on public.deleted_comments for select
  to authenticated
  using (true);

-- Kopier kommentaren til arkivet rett før den slettes.
create or replace function public.archive_deleted_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.deleted_comments (
    comment_id, user_id, title, body, category, status,
    lat, lng, created_at, updated_at, deleted_by, deleted_at
  ) values (
    old.id, old.user_id, old.title, old.body, old.category, old.status,
    old.lat, old.lng, old.created_at, old.updated_at, auth.uid(), now()
  );
  return old;
end;
$$;

drop trigger if exists comments_archive_on_delete on public.comments;
create trigger comments_archive_on_delete
  before delete on public.comments
  for each row execute function public.archive_deleted_comment();

-- View som slår opp visningsnavn for både forfatter og den som slettet.
create or replace view public.deleted_comments_with_authors
with (security_invoker = true) as
  select
    d.id,
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
