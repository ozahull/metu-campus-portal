-- 20260719220000_event_attendance_counts
-- DÜZELTME TURU 3 / Commit 7 — Liste kartı ile detay sayfası sayaç tutarsızlığı.
--
-- CANLI QA KANITI: Aynı etkinlik detayda "3 kişi katılıyor" (bilet sayısı, O19
-- düzeltmesi) ama liste kartında "1 Kişi Katılıyor" (hâlâ event_attendees).
--
-- FIX: Detayın kullandığı mantığın TOPLU (batch) karşılığı — liste sorguları
-- tek RPC çağrısıyla tüm kartların sayısını detayla BİREBİR aynı kaynaktan alır:
--   kulüp ticket_enabled → geçerli bilet sayısı (APPROVED + CHECKED_IN;
--   event_approved_ticket_count ile aynı küme), değilse RSVP (event_attendees).
-- SECURITY DEFINER tickets RLS'ini aşar ama yalnız SAYI döner (kimlik değil) ve
-- yalnız APPROVED (yayında) etkinlikler için — gizli etkinlik sayısı sızmaz.
--
-- İdempotent: create or replace.

create or replace function public.event_attendance_counts(p_event_ids uuid[])
returns table (event_id uuid, attend_count integer)
language sql
security definer
set search_path = ''
stable
as $$
  select e.id,
         case when coalesce(c.ticket_enabled, false) then
           (select count(*)::integer
              from public.tickets t
             where t.event_id = e.id and t.status in ('APPROVED', 'CHECKED_IN'))
         else
           (select count(*)::integer
              from public.event_attendees a
             where a.event_id = e.id)
         end
  from public.events e
  join public.clubs c on c.id = e.club_id
  where e.id = any(p_event_ids)
    and e.status = 'APPROVED';
$$;

grant execute on function public.event_attendance_counts(uuid[]) to authenticated;
