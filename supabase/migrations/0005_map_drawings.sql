-- Arbeidskart - tegninger (linjer og soner/polygoner)
-- Run this in the Supabase SQL editor after 0001_init.sql.
--
-- Lar brukere tegne linjer og polygoner direkte i kartet, f.eks. for å markere
-- et arbeidsområde, en trasé eller en sone som skal unngås.

create table if not exists public.map_drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  category text not null default 'arbeid',
  drawing_type text not null check (drawing_type in ('line', 'polygon')),
  -- GeoJSON geometry: LineString or Polygon (EPSG:4326, [lng, lat] order).
  geojson jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists map_drawings_created_at_idx
  on public.map_drawings (created_at desc);

alter table public.map_drawings enable row level security;

drop policy if exists "Drawings readable by authenticated users" on public.map_drawings;
create policy "Drawings readable by authenticated users"
  on public.map_drawings for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own drawings" on public.map_drawings;
create policy "Users can create their own drawings"
  on public.map_drawings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own drawings" on public.map_drawings;
create policy "Users can update their own drawings"
  on public.map_drawings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own drawings" on public.map_drawings;
create policy "Users can delete their own drawings"
  on public.map_drawings for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists map_drawings_touch_updated_at on public.map_drawings;
create trigger map_drawings_touch_updated_at
  before update on public.map_drawings
  for each row execute function public.touch_updated_at();

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
    p.full_name as author_name
  from public.map_drawings d
  left join public.profiles p on p.id = d.user_id;

-- Sikre at innloggede roller kan bruke tabellen via API.
grant select, insert, update, delete on public.map_drawings to authenticated;
grant select on public.map_drawings_with_author to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.map_drawings;
exception
  when duplicate_object then null;
end $$;
