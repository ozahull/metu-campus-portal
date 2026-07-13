-- 20260714130000_event_photos
-- Faz 8A — Etkinlik sonrası fotoğraf duvarı. Görseller mevcut club-images
-- (PUBLIC) bucket'ında events/{event_id}/{uuid}.ext yolunda tutulur (yeni
-- bucket YOK). Yazma yalnız o kulübün başkanı/danışmanı/okul.
-- KURAL: kolon grant'ları dar; istemciden upsert YASAK (yalnız insert/delete).

-- ============================================================================
-- 1) event_photos tablosu
-- ============================================================================
create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,   -- club-images içindeki yol: events/{event_id}/{uuid}.ext
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists event_photos_event_idx
  on public.event_photos (event_id, created_at desc);

alter table public.event_photos enable row level security;

-- Kolon-grant: okuma serbest; INSERT yalnız içerik kolonları; id/created_at yok.
revoke all on public.event_photos from authenticated;
revoke all on public.event_photos from anon;
grant select on public.event_photos to authenticated;
grant insert (event_id, uploader_id, storage_path, caption)
  on public.event_photos to authenticated;
grant delete on public.event_photos to authenticated;

-- SELECT: etkinlik görünürse (APPROVED) fotoğrafı da; yöneticiler her durumda.
drop policy if exists event_photos_select on public.event_photos;
create policy event_photos_select on public.event_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_photos.event_id
        and (
          e.status = 'APPROVED'
          or public.is_super_admin()
          or public.is_club_admin(e.club_id)
          or public.is_club_advisor(e.club_id)
        )
    )
  );

-- INSERT: yalnız kendi adına + o kulübün başkanı/danışmanı/okul.
drop policy if exists event_photos_insert on public.event_photos;
create policy event_photos_insert on public.event_photos
  for insert to authenticated
  with check (
    uploader_id = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = event_photos.event_id
        and (
          public.is_super_admin()
          or public.is_club_admin(e.club_id)
          or public.is_club_advisor(e.club_id)
        )
    )
  );

-- DELETE: aynı yetki.
drop policy if exists event_photos_delete on public.event_photos;
create policy event_photos_delete on public.event_photos
  for delete to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_photos.event_id
        and (
          public.is_super_admin()
          or public.is_club_admin(e.club_id)
          or public.is_club_advisor(e.club_id)
        )
    )
  );

-- ============================================================================
-- 2) Storage: club-images bucket'ında events/ ön ekli yol için yazma/silme
--    (mevcut clubimages_* politikaları club_id klasörü için; events/ ayrı).
-- ============================================================================
drop policy if exists "eventphotos_insert" on storage.objects;
create policy "eventphotos_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'club-images'
  and (storage.foldername(name))[1] = 'events'
  and exists (
    select 1 from public.events e
    where e.id::text = (storage.foldername(name))[2]
      and (
        public.is_club_admin(e.club_id)
        or public.is_club_advisor(e.club_id)
        or public.is_super_admin()
      )
  )
);

drop policy if exists "eventphotos_delete" on storage.objects;
create policy "eventphotos_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'club-images'
  and (storage.foldername(name))[1] = 'events'
  and exists (
    select 1 from public.events e
    where e.id::text = (storage.foldername(name))[2]
      and (
        public.is_club_admin(e.club_id)
        or public.is_club_advisor(e.club_id)
        or public.is_super_admin()
      )
  )
);

-- ============================================================================
-- 3) Bildirim: fotoğraf yayınlanınca katılanlara EVENT_PHOTOS (yeni tip)
-- ============================================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'EVENT_APPROVED','EVENT_NEW','EVENT_REMINDER','CLUB_ANNOUNCEMENT',
    'MEMBERSHIP','EVENT_PHOTOS'
  ));

-- Yükleme sonrası bir kez çağrılır; etkinliğe katılanlara (gönderen hariç,
-- tercihe saygı ile) tek bildirim. Son 1 saatte bildirilmişse tekrar etmez.
create or replace function public.event_photos_notify(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club uuid;
  v_title text;
  v_recent integer;
  v_count integer;
begin
  select club_id, title into v_club, v_title
  from public.events where id = p_event_id;
  if v_club is null then raise exception 'Etkinlik bulunamadı.'; end if;

  if not (
       public.is_super_admin()
       or public.is_club_admin(v_club)
       or public.is_club_advisor(v_club)
     ) then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;

  select count(*) into v_recent
  from public.notifications
  where event_id = p_event_id
    and type = 'EVENT_PHOTOS'
    and created_at > now() - interval '1 hour';
  if v_recent > 0 then return 0; end if;

  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  select a.user_id, 'EVENT_PHOTOS', v_title, null,
         '/events/' || p_event_id::text, v_club, p_event_id
  from public.event_attendees a
  where a.event_id = p_event_id
    and a.user_id <> auth.uid()
    and public.user_wants_notification(a.user_id, v_club);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.event_photos_notify(uuid) to authenticated;
