-- Arbeidskart - initial schema
-- Run this in the Supabase SQL editor (or via the Supabase CLI).

-- PostGIS for spatial queries (geometry column is generated from lat/lng).
create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, holds the display name shown on comments
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage their own profile"
  on public.profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Create a profile automatically when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- comments: a map note placed at a point, shared with all authenticated users
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  category text not null default 'annet',
  status text not null default 'apen',
  lat double precision not null,
  lng double precision not null,
  geom geometry(Point, 4326)
    generated always as (st_setsrid(st_makepoint(lng, lat), 4326)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_geom_idx on public.comments using gist (geom);
create index if not exists comments_created_at_idx on public.comments (created_at desc);

alter table public.comments enable row level security;

drop policy if exists "Comments are readable by authenticated users" on public.comments;
create policy "Comments are readable by authenticated users"
  on public.comments for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own comments" on public.comments;
create policy "Users can create their own comments"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own comments" on public.comments;
create policy "Users can update their own comments"
  on public.comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- Keep updated_at fresh on edits.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at
  before update on public.comments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- comment_photos: optional images attached to a comment (stored in Storage)
-- ---------------------------------------------------------------------------
create table if not exists public.comment_photos (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.comment_photos enable row level security;

drop policy if exists "Photos are readable by authenticated users" on public.comment_photos;
create policy "Photos are readable by authenticated users"
  on public.comment_photos for select
  to authenticated
  using (true);

drop policy if exists "Users manage their own photos" on public.comment_photos;
create policy "Users manage their own photos"
  on public.comment_photos for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A view that joins the author's display name for convenient reads.
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
    p.full_name as author_name
  from public.comments c
  left join public.profiles p on p.id = c.user_id;

-- Storage bucket for comment photos.
insert into storage.buckets (id, name, public)
values ('comment-photos', 'comment-photos', true)
on conflict (id) do nothing;

drop policy if exists "Photos are publicly readable" on storage.objects;
create policy "Photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'comment-photos');

drop policy if exists "Authenticated users can upload photos" on storage.objects;
create policy "Authenticated users can upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'comment-photos');

drop policy if exists "Users can delete their own photos" on storage.objects;
create policy "Users can delete their own photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'comment-photos' and owner = auth.uid());

-- Enable realtime broadcasts for the comments table.
alter publication supabase_realtime add table public.comments;
