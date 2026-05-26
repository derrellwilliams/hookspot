-- Migration: Add catches table and catch_id FK on photos
-- Run this in the Supabase SQL editor BEFORE deploying the feature/catches-table branch.
-- Safe to run against production: catch_id is nullable so existing photo rows are untouched.

-- 1. catches table
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

-- 2. FK on photos — nullable, existing rows unaffected
alter table photos add column catch_id uuid references catches(id) on delete set null;
