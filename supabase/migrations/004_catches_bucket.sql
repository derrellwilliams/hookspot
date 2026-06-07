-- Storage bucket and RLS policies for catch photos.
-- The catches bucket was previously created manually in the Supabase dashboard.
-- This migration documents the required bucket + policies so they can be reproduced.

insert into storage.buckets (id, name, public)
  values ('catches', 'catches', true)
  on conflict (id) do nothing;

create policy "catches readable by all"
  on storage.objects for select
  using (bucket_id = 'catches');

create policy "owner can upload catch photo"
  on storage.objects for insert
  with check (bucket_id = 'catches' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner can delete catch photo"
  on storage.objects for delete
  using (bucket_id = 'catches' and auth.uid()::text = (storage.foldername(name))[1]);
