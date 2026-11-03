-- Per-user daily cap on /identify, which spends Anthropic credits on every call.
-- Only the server (service_role) reads or writes this table, so RLS is on with
-- no policies and anon/authenticated deliberately get no grants (unlike other
-- public tables). backup_reader still needs select or the weekly pg_dump fails.
create table public.identify_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  count int not null default 1,
  primary key (user_id, day)
);

alter table public.identify_usage enable row level security;

grant select, insert, update, delete on public.identify_usage to service_role;
grant select on public.identify_usage to backup_reader;

-- Atomically counts one call and returns the day's total, so concurrent
-- requests can't slip past the cap.
create function public.bump_identify_usage(uid uuid)
returns int
language sql
security definer
set search_path = ''
as $$
  insert into public.identify_usage (user_id) values (uid)
  on conflict (user_id, day) do update set count = public.identify_usage.count + 1
  returning count;
$$;

revoke execute on function public.bump_identify_usage(uuid) from public, anon, authenticated;
grant execute on function public.bump_identify_usage(uuid) to service_role;
