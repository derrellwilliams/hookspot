-- ============================================================
-- Mobile RPCs: global catch visibility without the service role
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
--
-- The photos/catches RLS policies only allow owner-or-follower
-- reads. The web app reads everyone's catches through its API
-- (service role); the mobile app queries Supabase directly, so
-- these SECURITY DEFINER functions provide the same read-only
-- visibility the web has. Both are select-only and require an
-- authenticated caller.
-- ============================================================

-- All photos for one profile (public profile grids), with time/lat/lng
-- backfilled from the parent catch like /api/photos does.
-- Named return columns (not `setof photos`): the live table's physical column
-- order differs from schema.sql (later ALTERs append), and setof demands an
-- exact positional match. Clients read fields by name, so order is irrelevant.
create or replace function public.get_user_catches(profile_user_id uuid)
returns table (
  id uuid,
  user_id uuid,
  catch_id uuid,
  filename text,
  storage_path text,
  url text,
  thumb_url text,
  species text,
  lat double precision,
  lng double precision,
  "time" timestamptz,
  meta jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.user_id, p.catch_id, p.filename, p.storage_path, p.url,
    p.thumb_url, p.species, coalesce(p.lat, c.lat) as lat,
    coalesce(p.lng, c.lng) as lng, coalesce(p.time, c.time) as time,
    p.meta, p.created_at
  from photos p
  left join catches c on c.id = p.catch_id
  where p.user_id = profile_user_id
    and auth.uid() is not null
  order by coalesce(p.time, c.time) desc nulls last
$$;

-- Text + date search over everyone's photos (species / rod / fly),
-- mirroring /api/search-catches: matched rows plus sibling photos of
-- matched catches so the carousel shows whole catches.
create or replace function public.search_catches(
  q text default null,
  only_mine boolean default false,
  from_date date default null,
  to_date date default null
)
returns setof photos
language sql
security definer
set search_path = public
stable
as $$
  with matched as (
    select p.*
    from photos p
    where auth.uid() is not null
      and (
        q is null or q = '' or
        p.species ilike '%' || q || '%' or
        p.meta->>'rod' ilike '%' || q || '%' or
        p.meta->>'fly' ilike '%' || q || '%'
      )
      and (not only_mine or p.user_id = auth.uid())
      and (from_date is null or p.time >= from_date::timestamptz)
      and (to_date is null or p.time < (to_date + 1)::timestamptz)
    order by p.time desc nulls last
    limit 300
  )
  select * from matched
  union
  select p.*
  from photos p
  where auth.uid() is not null
    and p.catch_id in (select catch_id from matched where catch_id is not null)
$$;

grant execute on function public.get_user_catches(uuid) to authenticated;
grant execute on function public.search_catches(text, boolean, date, date) to authenticated;
revoke execute on function public.get_user_catches(uuid) from anon;
revoke execute on function public.search_catches(text, boolean, date, date) from anon;
