-- Sówki PWA v0.5.7.0
-- Publiczny bucket dla materiałów, które i tak są dostępne bez logowania:
-- wydarzenia, jadłospisy, ogłoszenia i wyniki ankiet.
-- Galeria pozostaje w prywatnym bucketcie sowki-media.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit
)
values (
  'sowki-public',
  'sowki-public',
  true,
  52428800
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "sowki_admin_select_public_media" on storage.objects;
create policy "sowki_admin_select_public_media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'sowki-public'
  and private.is_sowki_admin()
);

drop policy if exists "sowki_admin_insert_public_media" on storage.objects;
create policy "sowki_admin_insert_public_media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'sowki-public'
  and private.is_sowki_admin()
);

drop policy if exists "sowki_admin_update_public_media" on storage.objects;
create policy "sowki_admin_update_public_media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'sowki-public'
  and private.is_sowki_admin()
)
with check (
  bucket_id = 'sowki-public'
  and private.is_sowki_admin()
);

drop policy if exists "sowki_admin_delete_public_media" on storage.objects;
create policy "sowki_admin_delete_public_media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'sowki-public'
  and private.is_sowki_admin()
);

commit;
