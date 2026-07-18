-- 20260719120000_tickets_write_gate
-- DÜZELTME TURU 1 / Commit 1 — Bilet yazma kapısını kapat + iptal yolunu geri kazandır
-- + kapasite yarışını kapat (denetim bulguları K1 + Y8 + O12).
--
-- K1 (KRİTİK): tickets'a doğrudan INSERT grant'i (20260617120000:40) hâlâ açıktı.
--   Kolon-grant status'u engelliyor AMA status DEFAULT 'APPROVED' (20260715140000:26)
--   devreye giriyor → öğrenci `insert into tickets(event_id,user_id)` ile ticket_issue'nun
--   DÖRT kapısını (event.status='APPROVED', ticket_enabled, deadline, kapasite) tamamen
--   atlayarak geçerli APPROVED bilet basabiliyordu. Çözüm: doğrudan INSERT/DELETE grant'ını
--   kaldır; bilet üretimi yalnız ticket_issue (SECURITY DEFINER) üzerinden.
--
-- Y8: Aynı remove_payment_layer migration'ı tickets_delete politikasını ÖLÜ bıraktı —
--   using(status='PENDING_PAYMENT') artık CHECK'te olmayan bir durum → politika hiçbir
--   zaman true olamıyor → öğrenci bileti/yerini İPTAL EDEMİYOR. Yazma kapısı kapanırken
--   iptal yolu kaybolmasın diye ölü politikayı düşürüp yerine ticket_cancel RPC'si koyuyoruz.
--
-- O12: ticket_issue kapasite kontrolü read-then-write'tı (select count → insert); iki
--   eşzamanlı çağrı aynı count'u görüp kapasiteyi aşabiliyordu. Etkinlik satırını FOR UPDATE
--   ile kilitleyerek çağrıları serialize ediyoruz.
--
-- İdempotent: revoke/grant no-op; drop policy if exists; create or replace function.

-- ============================================================================
-- 1) Doğrudan yazma kapısını kapat (K1). SELECT/UPDATE grant'larına DOKUNMA:
--    SELECT kendi biletini görmek için, UPDATE ise ticket_checkin/ticket_issue
--    SECURITY DEFINER RPC'leri owner olarak yazdığından authenticated grant'ına
--    zaten ihtiyaç duymaz — ama mevcut grant'ı bozmamak için yalnız INSERT/DELETE'i al.
-- ============================================================================
revoke insert on public.tickets from authenticated;
revoke delete on public.tickets from authenticated;

-- ============================================================================
-- 2) Ölü DELETE politikasını düşür (Y8). Artık DELETE yolu yalnız ticket_cancel
--    RPC'si (definer) üzerinden; tabloya doğrudan DELETE grant'ı da kalktı.
-- ============================================================================
drop policy if exists tickets_delete on public.tickets;

-- ============================================================================
-- 3) tickets_insert politikası artık işlevsiz (INSERT grant'ı yok) ama zararsız;
--    yine de tutarlılık için düşürüyoruz — doğrudan insert yolu tamamen kapalı.
-- ============================================================================
drop policy if exists tickets_insert on public.tickets;

-- ============================================================================
-- 4) Çift bilet güvencesi (O12/idempotency): tickets tablosunda zaten
--    `unique (event_id, user_id)` constraint'i var (20260617120000:29) — ticket_issue'nun
--    `on conflict (event_id, user_id) do nothing` yolu buna dayanır. Ek index GEREKSİZ;
--    yalnız doğrulama amaçlı, ayrı bir index EKLEMİYORUZ (constraint yeterli, tekrar
--    çalıştırmada çakışma yaratmasın).
-- ============================================================================

-- ============================================================================
-- 5) ticket_issue — kapasite yarışını FOR UPDATE ile kapat (O12).
--    İş kuralları (APPROVED etkinlik, ticket_enabled, deadline, kapasite, çift bilet)
--    AYNEN korunur; yalnızca etkinlik satırı kilitlenerek count↔insert atomikleşir.
-- ============================================================================
create or replace function public.ticket_issue(p_event uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_enabled boolean;
  v_capacity integer;
  v_deadline timestamptz;
  v_event_date timestamptz;
  v_status text;
  v_count integer;
  v_existing uuid;
begin
  -- Etkinlik satırını KİLİTLE: eşzamanlı ticket_issue çağrıları bu satır üzerinde
  -- serialize olur (ilk çağrı commit edene kadar ikincisi bekler ve güncel bilet
  -- sayısını görür) → kapasite kontrolü ile insert arasındaki yarış (O12) kapanır.
  select e.club_id, e.ticket_capacity, e.ticket_deadline, e.event_date, e.status
    into v_club_id, v_capacity, v_deadline, v_event_date, v_status
  from public.events e
  where e.id = p_event
  for update;

  if v_club_id is null then
    raise exception 'Etkinlik bulunamadı';
  end if;

  -- Kulübün bilet anahtarı (opt-in) — yalnız okuma, kilit gerektirmez.
  select c.ticket_enabled into v_enabled
  from public.clubs c where c.id = v_club_id;

  if v_status <> 'APPROVED' then
    raise exception 'Etkinlik yayında değil';
  end if;
  if not coalesce(v_enabled, false) then
    raise exception 'Bu etkinlikte katılım bileti kapalı';
  end if;

  -- İdempotent: mevcut bilet varsa hiçbir şey yapma (çift bilet yok).
  select id into v_existing
  from public.tickets
  where event_id = p_event and user_id = auth.uid();
  if v_existing is not null then
    return;
  end if;

  -- Son tarih: ticket_deadline ya da (tanımsızsa) etkinlik saati.
  if coalesce(v_deadline, v_event_date) <= now() then
    raise exception 'Bilet alımı kapandı';
  end if;

  -- Kapasite: geçerli (APPROVED + CHECKED_IN) bilet sayısı. FOR UPDATE kilidi
  -- sayesinde bu count ile aşağıdaki insert atomik bir bütün gibi davranır.
  if v_capacity is not null then
    select count(*) into v_count
    from public.tickets
    where event_id = p_event and status in ('APPROVED', 'CHECKED_IN');
    if v_count >= v_capacity then
      raise exception 'Kapasite dolu';
    end if;
  end if;

  insert into public.tickets (event_id, user_id, status)
  values (p_event, auth.uid(), 'APPROVED')
  on conflict (event_id, user_id) do nothing;
end;
$$;

grant execute on function public.ticket_issue(uuid) to authenticated;

-- ============================================================================
-- 6) ticket_cancel — öğrenci kendi (henüz kullanılmamış) biletini iptal eder (Y8).
--    Kurallar: bilet çağırana ait; status='APPROVED' (CHECKED_IN iptal edilemez);
--    etkinlik henüz başlamamış (event_date > now()). Bilet SİLİNİR → kapasite otomatik
--    boşalır (ticket_issue count satır sayar). İdempotent: bilet zaten yoksa sessizce
--    başarı döner (çift tık / yarış güvenli).
-- ============================================================================
create or replace function public.ticket_cancel(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_status text;
  v_event_date timestamptz;
begin
  select t.user_id, t.status, e.event_date
    into v_user, v_status, v_event_date
  from public.tickets t
  join public.events e on e.id = t.event_id
  where t.id = p_ticket_id;

  -- İdempotent: bilet yoksa sessizce başarı (zaten iptal edilmiş / hiç olmamış).
  if not found then
    return;
  end if;

  if v_user <> auth.uid() then
    raise exception 'Bu bilet size ait değil';
  end if;
  if v_status = 'CHECKED_IN' then
    raise exception 'Giriş yapılmış bilet iptal edilemez';
  end if;
  if v_status <> 'APPROVED' then
    raise exception 'Bu bilet iptal edilemez';
  end if;
  if v_event_date <= now() then
    raise exception 'Etkinlik başladı, bilet iptal edilemez';
  end if;

  delete from public.tickets where id = p_ticket_id;
end;
$$;

grant execute on function public.ticket_cancel(uuid) to authenticated;
