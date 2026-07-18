-- 20260719210000_event_updated_notify_fix
-- DÜZELTME TURU 3 / Commit 5 — EVENT_UPDATED bildirimi biletli katılımcıya gitmiyor.
--
-- CANLI QA KANITI: Onaylı etkinliğin KONUMU değişti (kayıt başarılı) ama bileti
-- olan öğrenciye hiçbir bildirim düşmedi.
--
-- TANI: on_event_updated (20260719180000) alıcı sorgusu DOĞRU tabloları tarıyor
-- (event_attendees UNION tickets) ve location değişiminde de ateşliyor; eleyen
-- katman SON FİLTRE: user_wants_notification(uid, club_id). Varsayılan tercih
-- 'MEMBER_CLUBS' yalnız kulüp üyesine/danışmanına izin verir — bilet alan ya da
-- RSVP veren öğrenci kulübe ÜYE DEĞİLSE bildirim üretilmez. Oysa bu kişinin
-- etkinlikle AÇIK bir ilişkisi var (bileti/RSVP'si); "üye olduğum kulüpler"
-- tercihi, kendi kaydolduğu etkinliğin değişikliğini susturmamalı.
--
-- FIX: Etkinlik-ilişkili bildirimler için ayrı tercih kapısı:
--   user_wants_event_notification → yalnız 'NONE' susturur; 'MEMBER_CLUBS' ve
--   'ALL' geçirir (kişi zaten etkinliğe kendi iradesiyle kayıtlı).
-- on_event_updated bu kapıyı kullanacak şekilde TAMAMEN yeniden kurulur — canlıda
-- eski/bayat bir varyant kalmışsa da bu migration onu ezer (kendi kendini onarır).
--
-- İdempotent: create or replace + drop trigger if exists.

-- ============================================================================
-- 1) Etkinlik-ilişkili bildirim tercihi: yalnız NONE susturur.
--    (Kulüp-genel yayınlar — EVENT_NEW, duyuru — user_wants_notification'da
--    kalır; bu kapı SADECE kişinin kayıtlı olduğu etkinliğin değişiklikleri için.)
-- ============================================================================
create or replace function public.user_wants_event_notification(p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
      (select scope from public.notification_preferences where user_id = p_user),
      'MEMBER_CLUBS') <> 'NONE';
$$;

grant execute on function public.user_wants_event_notification(uuid) to authenticated;

-- ============================================================================
-- 2) on_event_updated — alıcılar: RSVP (event_attendees) ∪ bilet (tickets),
--    distinct, düzenleyen hariç; tercih kapısı user_wants_event_notification.
--    Ateşleme koşulu AYNEN: APPROVED etkinlikte event_date VEYA location değişimi.
-- ============================================================================
create or replace function public.on_event_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text := '/events/' || new.id::text;
begin
  if new.status = 'APPROVED'
     and (new.event_date is distinct from old.event_date
          or new.location is distinct from old.location) then
    insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
    select recips.uid, 'EVENT_UPDATED', new.title, null, v_link, new.club_id, new.id
    from (
      select a.user_id as uid from public.event_attendees a where a.event_id = new.id
      union
      select tk.user_id from public.tickets tk where tk.event_id = new.id
    ) recips
    where (auth.uid() is null or recips.uid <> auth.uid())
      and public.user_wants_event_notification(recips.uid);
  end if;
  return new;
end;
$$;

drop trigger if exists events_notify_updated on public.events;
create trigger events_notify_updated
  after update on public.events
  for each row execute function public.on_event_updated();
