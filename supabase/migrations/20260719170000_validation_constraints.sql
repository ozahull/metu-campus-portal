-- 20260719170000_validation_constraints
-- DÜZELTME TURU 2 / Commit 2 — Sunucu doğrulama katmanı (Y6 + O9 + O20 + O15).
--
-- Bu alanlar RPC'den DEĞİL doğrudan insert/update ile yazılıyor (new-club-form,
-- club-info-form, manage-events, profile-form) → istemci trim'i bypass edilebiliyordu.
--
-- Y6: negatif ticket_capacity ("0 >= -1" hep doğru → etkinlik sessizce kilitlenir),
--     boşluk-only kulüp adı / etkinlik başlığı.
-- O9: ticket_deadline etkinlik başlangıcından SONRA olabiliyordu (etkinlik bittikten
--     sonra bile bilet üretimi).
-- O20: geçmiş tarihli etkinlik oluşturulabiliyordu (yeni oluşturmada engel yok).
-- O15: aynı hoca birden fazla PENDING başvuru açabiliyordu (bildirim spam + çift kulüp).
--
-- ÖNCE mevcut ihlalleri temizle (CHECK/index eklenince patlamasın), SONRA kısıtları ekle.
-- Min uzunluk 1 (canlıdaki "." adlı / "ç" açıklamalı tek-karakter test kulüpleri geçer);
-- max 200 (layout). İdempotent: drop constraint/trigger/index if exists + create.

-- ============================================================================
-- 1) VERİ TEMİZLİĞİ (kısıtları eklemeden önce)
-- ============================================================================
-- Boşluk-only ad/başlık → trim; tamamen boşsa placeholder.
update public.clubs
   set name = case when btrim(name) = '' then 'İsimsiz Topluluk' else btrim(name) end
 where name is null or name <> btrim(name) or btrim(name) = '';
update public.clubs set name = left(name, 200) where char_length(name) > 200;

update public.events
   set title = case when btrim(title) = '' then 'İsimsiz Etkinlik' else btrim(title) end
 where title is null or title <> btrim(title) or btrim(title) = '';
update public.events set title = left(title, 200) where char_length(title) > 200;

-- Geçersiz kapasite (<=0) → null (sınırsız). deadline > event_date → null (etkinlik saati).
update public.events set ticket_capacity = null
 where ticket_capacity is not null and ticket_capacity <= 0;
update public.events set ticket_deadline = null
 where ticket_deadline is not null and ticket_deadline > event_date;

-- Aynı hocanın birden çok PENDING başvurusu: en yenisini tut, eskileri REJECTED yap
-- (partial unique index eklenmeden önce tekilliği sağla).
with ranked as (
  select id,
         row_number() over (partition by requested_by order by created_at desc, id desc) as rn
  from public.club_requests
  where status = 'PENDING'
)
update public.club_requests r
   set status = 'REJECTED',
       review_note = coalesce(r.review_note, 'Otomatik: aynı anda birden fazla başvuru; en yenisi korundu.'),
       updated_at = now()
  from ranked
 where r.id = ranked.id and ranked.rn > 1;

-- ============================================================================
-- 2) CHECK'ler
-- ============================================================================
alter table public.clubs drop constraint if exists clubs_name_len_check;
alter table public.clubs
  add constraint clubs_name_len_check
  check (char_length(btrim(name)) between 1 and 200);

alter table public.events drop constraint if exists events_title_len_check;
alter table public.events
  add constraint events_title_len_check
  check (char_length(btrim(title)) between 1 and 200);

alter table public.events drop constraint if exists events_ticket_capacity_check;
alter table public.events
  add constraint events_ticket_capacity_check
  check (ticket_capacity is null or ticket_capacity > 0);

-- O9: bilet son tarihi etkinlik başlangıcından sonra OLAMAZ.
alter table public.events drop constraint if exists events_ticket_deadline_check;
alter table public.events
  add constraint events_ticket_deadline_check
  check (ticket_deadline is null or ticket_deadline <= event_date);

-- ============================================================================
-- 3) O20 — Geçmiş tarihli etkinlik OLUŞTURULAMAZ (yalnız INSERT; düzenleme serbest).
--    CHECK op ayrımı yapamadığından (UPDATE'i de engellerdi → geçmiş etkinlik
--    düzenlenemezdi) BEFORE INSERT trigger kullanılır.
-- ============================================================================
create or replace function public.enforce_future_event_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.event_date <= now() then
    raise exception 'Etkinlik tarihi gelecekte olmalı.';
  end if;
  return new;
end;
$$;

drop trigger if exists events_future_date_insert on public.events;
create trigger events_future_date_insert
  before insert on public.events
  for each row execute function public.enforce_future_event_on_insert();

-- ============================================================================
-- 4) O15 — Başvuru tekilliği: aynı hoca aynı anda tek PENDING (partial unique index).
-- ============================================================================
create unique index if not exists club_requests_one_pending_per_user
  on public.club_requests (requested_by)
  where status = 'PENDING';

-- club_request_submit — PENDING ön-kontrolü (anlaşılır hata; partial index son savunma).
-- Tur 1 (20260719140000) tercih-kontrollü gövdesini korur; yalnız guard eklenir.
create or replace function public.club_request_submit(
  p_name text,
  p_description text,
  p_category text,
  p_rationale text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_advisor() then
    raise exception 'Yalnızca hocalar topluluk açma başvurusu yapabilir.';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Topluluk adı gerekli.';
  end if;
  if coalesce(btrim(p_rationale), '') = '' then
    raise exception 'Gerekçe gerekli.';
  end if;
  -- O15: bekleyen bir başvuru varken ikincisi açılamaz.
  if exists (
    select 1 from public.club_requests
    where requested_by = auth.uid() and status = 'PENDING'
  ) then
    raise exception 'Zaten bekleyen bir başvurunuz var. Sonucu bekleyin.';
  end if;

  insert into public.club_requests
    (requested_by, name, description, category, rationale, status)
  values (
    auth.uid(),
    btrim(p_name),
    nullif(btrim(p_description), ''),
    nullif(btrim(p_category), ''),
    btrim(p_rationale),
    'PENDING'
  )
  returning id into v_id;

  -- OKUL yönetimine (tüm SUPER_ADMIN) yeni başvuru bildirimi — TERCİHE SAYGILI (Y5).
  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  select p.id, 'CLUB_REQUEST', btrim(p_name), 'NEW', '/admin', null, null
  from public.profiles p
  where upper(btrim(p.role::text)) = 'SUPER_ADMIN'
    and public.user_wants_notification(p.id, null);

  return v_id;
end;
$$;

grant execute on function public.club_request_submit(text, text, text, text) to authenticated;
