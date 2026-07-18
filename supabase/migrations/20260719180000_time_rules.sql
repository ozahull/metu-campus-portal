-- 20260719180000_time_rules
-- DÜZELTME TURU 2 / Commit 3 — Zaman kuralları (O10 + O11).
--
-- O10: ticket_checkin yalnız token+yetki+status bakıyordu → etkinlikten aylar önce/sonra
--   check-in yapılabiliyordu (rozet tetiklenerek). Makul zaman penceresi eklenir.
-- O11: onaylı etkinliğin tarihi/konumu yeniden-onaysız değişebiliyor, katılanlar habersiz
--   kalıyordu. KARAR: yeniden onay GEREKMESİN (yönetim yükü), ama katılımcı + bilet
--   sahiplerine EVENT_UPDATED bildirimi ŞART.
--
-- İdempotent: create or replace / drop trigger if exists / drop constraint + add.

-- ============================================================================
-- O10 — ticket_checkin zaman penceresi.
--   Pencere: etkinlik başlangıcından 2 saat ÖNCE açılır; varsayılan 6 saatlik süre
--   (bitiş alanı yok) + 4 saat tolerans ile kapanır → [start - 2h, start + 10h].
--   Sabitler yorumla belgeli; gerisi (token/yetki/tek-kullanım) AYNEN korunur.
-- ============================================================================
drop function if exists public.ticket_checkin(text);
create function public.ticket_checkin(p_token text)
returns table (ticket_id uuid, full_name text, event_title text)
language plpgsql security definer set search_path = '' as $$
declare
  v_club_id uuid;
  v_status text;
  v_tid uuid;
  v_event_date timestamptz;
  -- Check-in penceresi sabitleri (etkinlik bitiş alanı olmadığından varsayım):
  --   açılış: başlangıç - 2 saat, kapanış: başlangıç + 6 saat (süre) + 4 saat (tolerans).
  v_open_before  interval := interval '2 hours';
  v_close_after  interval := interval '10 hours';
begin
  select t.id, t.status, e.club_id, e.event_date
    into v_tid, v_status, v_club_id, v_event_date
  from public.tickets t join public.events e on e.id = t.event_id
  where t.token = upper(p_token);

  if v_tid is null then raise exception 'Geçersiz bilet'; end if;
  if not (public.is_super_admin() or public.is_club_admin(v_club_id) or public.is_club_advisor(v_club_id)) then
    raise exception 'Yetkisiz';
  end if;
  if v_status = 'CHECKED_IN' then raise exception 'Bu bilet zaten kullanıldı'; end if;
  if v_status <> 'APPROVED' then raise exception 'Bilet geçerli değil (onaylı değil)'; end if;

  -- O10: zaman penceresi dışında check-in yapılamaz.
  if now() < v_event_date - v_open_before then
    raise exception 'Giriş henüz açılmadı (etkinlik başlangıcından en erken 2 saat önce).';
  end if;
  if now() > v_event_date + v_close_after then
    raise exception 'Giriş süresi doldu (etkinlik bitiminden sonra).';
  end if;

  update public.tickets set status='CHECKED_IN', checked_in_at=now(), updated_at=now()
   where id = v_tid;

  return query
  select t.id, p.full_name, e.title
  from public.tickets t
  join public.profiles p on p.id = t.user_id
  join public.events e on e.id = t.event_id
  where t.id = v_tid;
end; $$;

grant execute on function public.ticket_checkin(text) to authenticated;

-- ============================================================================
-- O11.1 — EVENT_UPDATED bildirim tipini CHECK'e ekle (idempotent drop+add).
-- ============================================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'EVENT_APPROVED','EVENT_NEW','EVENT_REMINDER','CLUB_ANNOUNCEMENT','MEMBERSHIP',
  'EVENT_PHOTOS','BADGE_EARNED','CLUB_REQUEST','MESSAGE','EVENT_UPDATED'
));

-- ============================================================================
-- O11.2 — Onaylı etkinlikte tarih/konum değişince katılımcı + bilet sahiplerine bildirim.
--   Yeniden onay TETİKLENMEZ (status'a dokunulmaz); yalnız haber verilir. Düzenleyen
--   (auth.uid()) hariç, tercihe saygılı, kişi başına TEK (union → distinct).
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
      and public.user_wants_notification(recips.uid, new.club_id);
  end if;
  return new;
end;
$$;

drop trigger if exists events_notify_updated on public.events;
create trigger events_notify_updated
  after update on public.events
  for each row execute function public.on_event_updated();
