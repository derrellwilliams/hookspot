-- ============================================================
-- Hook Spot schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- profiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  favorites jsonb default '[]',
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "profiles readable by all"  on profiles for select using (true);
create policy "owner can insert profile"  on profiles for insert with check (auth.uid() = id);
create policy "owner can update profile"  on profiles for update using (auth.uid() = id);

-- follows (must exist before photos policy references it)
create table follows (
  follower_id uuid references auth.users on delete cascade not null,
  following_id uuid references auth.users on delete cascade not null,
  primary key (follower_id, following_id)
);
alter table follows enable row level security;
create policy "follows readable by all" on follows for select using (true);
create policy "owner can follow"        on follows for insert with check (auth.uid() = follower_id);
create policy "owner can unfollow"      on follows for delete using (auth.uid() = follower_id);

-- catches (one row per upload session; photos reference this via catch_id)
create table catches (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references auth.users on delete cascade not null,
  species    text,
  rod        text,
  fly        text,
  lat        double precision,
  lng        double precision,
  time       timestamptz,
  created_at timestamptz default now()
);
alter table catches enable row level security;
create policy "owner or follower can select" on catches for select using (
  auth.uid() = user_id or
  exists (select 1 from follows where follower_id = auth.uid() and following_id = user_id)
);
create policy "owner can insert" on catches for insert with check (auth.uid() = user_id);
create policy "owner can update" on catches for update using (auth.uid() = user_id);
create policy "owner can delete" on catches for delete using (auth.uid() = user_id);

-- photos (individual media attached to a catch; catch_id null for legacy photos)
create table photos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  catch_id uuid references catches(id) on delete set null,
  filename text not null,
  storage_path text not null,
  url text not null,
  thumb_url text, -- best-effort ~960px grid thumbnail, generated at upload time; nullable, falls back to url
  species text,
  lat double precision,
  lng double precision,
  time timestamptz,
  meta jsonb default '{}',
  created_at timestamptz default now()
);
alter table photos enable row level security;
create policy "owner or follower can select" on photos for select using (
  auth.uid() = user_id or
  exists (
    select 1 from follows
    where follower_id = auth.uid() and following_id = user_id
  )
);
create policy "owner can insert" on photos for insert with check (auth.uid() = user_id);
create policy "owner can update" on photos for update using (auth.uid() = user_id);
create policy "owner can delete" on photos for delete using (auth.uid() = user_id);

-- auto-create profile on signup (uses email prefix as default username)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- storage buckets (run separately or create manually in Storage tab)
-- insert into storage.buckets (id, name, public) values ('catches', 'catches', true);
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
-- See migrations/003_avatars_bucket.sql for full avatars bucket + RLS policies.
