-- Matcha Muse schema v1 (spec 2026-07-07)
create table cafes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  suburb text,
  latitude double precision,
  longitude double precision,
  google_place_id text unique,
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  cafe_id uuid references cafes(id),
  photo_path text,
  drank_at timestamptz not null default now(),
  overall numeric(2,1) not null check (overall between 0.5 and 5),
  taste numeric(2,1) check (taste between 0.5 and 5),
  sweetness numeric(2,1) check (sweetness between 0.5 and 5),
  texture numeric(2,1) check (texture between 0.5 and 5),
  temperature text check (temperature in ('hot','iced')),
  milk text check (milk in ('dairy','oat','soy','almond','coconut','other')),
  drink_style text check (drink_style in ('latte','hybrid','other')),
  size text check (size in ('S','M','L')),
  price numeric(6,2) not null check (price >= 0),
  occasions text[] not null default '{}',
  note text,
  status text not null default 'complete' check (status in ('complete','draft')),
  created_at timestamptz not null default now()
);

create table menu_photos (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafes(id),
  photo_path text not null,
  taken_at timestamptz not null default now()
);

alter table cafes enable row level security;
alter table reviews enable row level security;
alter table menu_photos enable row level security;

create policy "authenticated full access to cafes" on cafes
  for all to authenticated using (true) with check (true);
create policy "own reviews only" on reviews
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "authenticated full access to menu photos" on menu_photos
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('photos', 'photos', false);
create policy "authenticated read photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos');
create policy "authenticated upload photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
-- Added 2026-07-10 (review-detail feature): photo cleanup on edit/delete needs
-- delete rights; without this policy every cleanup silently failed (orphans).
create policy "authenticated can delete photos" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');

-- Added 2026-07-12 (shared-journal feature): reviewer profiles + shared visibility.
create table profiles (
  id uuid primary key references auth.users(id),
  display_name text not null,
  about_me text,
  avatar_path text,
  quiz jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "authenticated read profiles" on profiles
  for select to authenticated using (true);
create policy "insert own profile" on profiles
  for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Reviews: everyone signed in reads completed reviews; drafts stay private;
-- writes remain owner-only. Replaces the v1 "own reviews only" FOR ALL policy.
drop policy "own reviews only" on reviews;
create policy "read completed or own reviews" on reviews
  for select to authenticated
  using (status = 'complete' or user_id = auth.uid());
create policy "insert own reviews" on reviews
  for insert to authenticated with check (user_id = auth.uid());
create policy "update own reviews" on reviews
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own reviews" on reviews
  for delete to authenticated using (user_id = auth.uid());
