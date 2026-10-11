-- Security + performance fixes from the Supabase advisors (2026-10-11).

-- 1. SECURITY DEFINER functions: functions are executable by PUBLIC by default,
--    so revoking from `anon` alone (mobile-rpcs.sql) was a no-op.
revoke execute on function public.get_user_catches(uuid) from public, anon;
revoke execute on function public.search_catches(text, boolean, date, date) from public, anon;
grant execute on function public.get_user_catches(uuid) to authenticated;
grant execute on function public.search_catches(text, boolean, date, date) to authenticated;

-- Event-trigger function; never meant to be callable via /rest/v1/rpc.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2. Covering indexes for foreign keys.
create index if not exists catches_user_id_idx on public.catches (user_id);
create index if not exists photos_user_id_idx on public.photos (user_id);
create index if not exists photos_catch_id_idx on public.photos (catch_id);
create index if not exists follows_following_id_idx on public.follows (following_id);

-- 3. Duplicate permissive SELECT policy on profiles.
drop policy if exists "profiles readable by all" on public.profiles;

-- 4. RLS: wrap auth.uid() in a subselect so it's evaluated once per query,
--    not once per row. Semantics unchanged.
alter policy "owner can insert profile" on public.profiles
  with check ((select auth.uid()) = id);
alter policy "owner can update profile" on public.profiles
  using ((select auth.uid()) = id);

alter policy "owner can follow" on public.follows
  with check ((select auth.uid()) = follower_id);
alter policy "owner can unfollow" on public.follows
  using ((select auth.uid()) = follower_id);

alter policy "owner or follower can select" on public.photos
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.follows
      where follows.follower_id = (select auth.uid())
        and follows.following_id = photos.user_id
    )
  );
alter policy "owner can insert" on public.photos
  with check ((select auth.uid()) = user_id);
alter policy "owner can update" on public.photos
  using ((select auth.uid()) = user_id);
alter policy "owner can delete" on public.photos
  using ((select auth.uid()) = user_id);

alter policy "owner or follower can select" on public.catches
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.follows
      where follows.follower_id = (select auth.uid())
        and follows.following_id = catches.user_id
    )
  );
alter policy "owner can insert" on public.catches
  with check ((select auth.uid()) = user_id);
alter policy "owner can update" on public.catches
  using ((select auth.uid()) = user_id);
alter policy "owner can delete" on public.catches
  using ((select auth.uid()) = user_id);
