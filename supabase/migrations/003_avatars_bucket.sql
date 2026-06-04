-- Create public avatars bucket for profile photos.
-- Avatars are stored at {userId}/avatar.jpg and overwritten on update.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "avatars readable by all"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "owner can upload avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner can update avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
