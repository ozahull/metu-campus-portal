-- NOT: club-images bucket'ı PUBLIC olarak Supabase panelinden elle oluşturuldu
-- (SQL ile DEĞİL). Bu migration yalnızca storage.objects yazma politikalarını içerir.

-- 20260617160000_club_images
-- Görsel yükleme: club-images (PUBLIC bucket) yazma kısıtları
-- okuma public (policy gerekmez); yazma/değiştirme/silme yalnız başkan/okul
-- path deseni: ${club_id}/logo-${timestamp}.ext  |  ${club_id}/cover-${timestamp}.ext

-- INSERT: yalnız o kulübün başkanı/okul
drop policy if exists "clubimages_insert" on storage.objects;
create policy "clubimages_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'club-images'
  and exists (
    select 1 from public.clubs c
    where c.id::text = (storage.foldername(name))[1]
      and (public.is_club_admin(c.id) or public.is_super_admin())
  )
);

-- UPDATE: aynı kısıt (upsert ihtimaline karşı)
drop policy if exists "clubimages_update" on storage.objects;
create policy "clubimages_update" on storage.objects for update to authenticated
using (
  bucket_id = 'club-images'
  and exists (
    select 1 from public.clubs c
    where c.id::text = (storage.foldername(name))[1]
      and (public.is_club_admin(c.id) or public.is_super_admin())
  )
)
with check (
  bucket_id = 'club-images'
  and exists (
    select 1 from public.clubs c
    where c.id::text = (storage.foldername(name))[1]
      and (public.is_club_admin(c.id) or public.is_super_admin())
  )
);

-- DELETE: aynı kısıt (eski logo/kapak silme)
drop policy if exists "clubimages_delete" on storage.objects;
create policy "clubimages_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'club-images'
  and exists (
    select 1 from public.clubs c
    where c.id::text = (storage.foldername(name))[1]
      and (public.is_club_admin(c.id) or public.is_super_admin())
  )
);
