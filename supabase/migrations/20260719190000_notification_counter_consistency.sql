-- 20260719190000_notification_counter_consistency
-- DÜZELTME TURU 2 / Commit 4 — Çift bildirim (O13) + kapasite sayacı (O19).
--
-- O13: on_event_approved üç ayrı sorguyla yazıyordu (üyeler EVENT_NEW, başkanlar
--   EVENT_APPROVED, danışman EVENT_APPROVED) → danışman aynı zamanda üye/başkansa AYNI
--   olaydan iki bildirim alıyordu. Alıcılar tek sette birleştirilir; kişi başına TEK
--   bildirim, tipi rolüne göre (yönetici=danışman/başkan → EVENT_APPROVED, üye → EVENT_NEW).
--
-- O19: biletli etkinlikte kapasite barı toplam bilet sayısına ihtiyaç duyar ama tickets
--   RLS öğrenciye yalnız kendi biletini gösterir. Güvenli sayım için SECURITY DEFINER
--   count RPC'si (yalnız sayı döner, kimlik değil).
--
-- İdempotent: create or replace.

-- ============================================================================
-- O13 — on_event_approved: alıcılar birleşik, kişi başına tek bildirim.
-- ============================================================================
create or replace function public.on_event_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_advisor uuid;
  v_link text := '/events/' || new.id::text;
begin
  select advisor_id into v_advisor from public.clubs where id = new.club_id;

  -- Alıcı seti: kulüp üyeleri (başkan=yönetici, üye=değil) + danışman (yönetici, üye
  -- olmayabilir). Aynı kişi birden fazla rolle gelirse bool_or ile yönetici kazanır →
  -- kişi başına TEK satır. Yönetici → EVENT_APPROVED, sıradan üye → EVENT_NEW.
  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  select r.uid,
         case when r.is_manager then 'EVENT_APPROVED' else 'EVENT_NEW' end,
         new.title, null, v_link, new.club_id, new.id
  from (
    select uid, bool_or(is_manager) as is_manager
    from (
      select m.user_id as uid,
             (upper(btrim(m.role::text)) = 'ADMIN') as is_manager
      from public.club_members m
      where m.club_id = new.club_id
      union all
      select v_advisor as uid, true as is_manager
      where v_advisor is not null
    ) all_recips
    group by uid
  ) r
  where public.user_wants_notification(r.uid, new.club_id);

  return new;
end;
$$;

-- ============================================================================
-- O19 — event_approved_ticket_count: geçerli (APPROVED+CHECKED_IN) bilet sayısı.
--   SECURITY DEFINER → RLS'i aşar; yalnız SAYI döner (kimlik değil), kapasite barı için.
-- ============================================================================
create or replace function public.event_approved_ticket_count(p_event uuid)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.tickets
  where event_id = p_event and status in ('APPROVED', 'CHECKED_IN');
$$;

grant execute on function public.event_approved_ticket_count(uuid) to authenticated;
