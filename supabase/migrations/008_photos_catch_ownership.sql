-- A photo may only point at a catch its own user owns. The FK on catch_id
-- skips RLS, so without this any signed-in user could attach photos to
-- someone else's catch (catch ids are public via /api/photos), and grouping
-- by catch_id would show them inside — or credited over — that catch.
-- The policy part was applied in the SQL Editor on 2026-11-03.
alter policy "owner can insert" on public.photos
  with check (
    (select auth.uid()) = user_id
    and (catch_id is null or exists (
      select 1 from public.catches c
      where c.id = catch_id and c.user_id = (select auth.uid())
    ))
  );

alter policy "owner can update" on public.photos
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (catch_id is null or exists (
      select 1 from public.catches c
      where c.id = catch_id and c.user_id = (select auth.uid())
    ))
  );

-- iOS search: only pull in siblings that belong to the matched photo's owner
-- (mirrors search-catches-handler.js). Same as mobile-rpcs.sql.
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
    and (p.catch_id, p.user_id) in (select catch_id, user_id from matched where catch_id is not null)
$$;

-- create or replace keeps existing grants; restated so this file stands alone.
revoke execute on function public.search_catches(text, boolean, date, date) from public, anon;
grant execute on function public.search_catches(text, boolean, date, date) to authenticated;
