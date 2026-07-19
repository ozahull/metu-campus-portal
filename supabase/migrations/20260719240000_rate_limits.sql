-- 20260719240000_rate_limits
-- GÜVENLİK SERTLEŞTİRME #5 — kritik yazma yollarına zaman-pencereli hız sınırı.
--
-- Mevcut tek koruma club_announce'daki saatlik 3 duyuruydu (o pencere zaten
-- KAYAN: created_at > now() - interval '1 hour' — değişiklik gerekmez).
-- Eksikler: mesaj gönderme (doğrudan INSERT, RPC yok → sınır BEFORE INSERT
-- trigger'ında) ve ticket_issue (çağrı hızı sınırsız).
--
-- Tasarım notu: sayaçlar BAŞARILI yazımlar üzerinden kayan pencereyle tutulur
-- (ayrı deneme tablosu YOK — başarısız çağrılar rollback'te iz bırakmaz;
-- ağ-katmanı seli Vercel/WAF konusudur, buradaki amaç uygulama içi spam/sel
-- baskısını kesmek). Limitler sabit ve yorumlu; aşımda anlaşılır Türkçe hata
-- (istemci known-errors eşlemesi bu metinlerin başlangıcını tanır).
--
-- İdempotent: create or replace + drop trigger if exists.

-- ============================================================================
-- 1) Mesaj hız sınırı — kişi başına dakikada en fazla 20 mesaj (KAYAN pencere).
--    sender_user_id DEFAULT auth.uid() ile dolar ve default'lar BEFORE
--    trigger'dan ÖNCE uygulanır → new.sender_user_id burada güvenilir.
-- ============================================================================
create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Limit: 20 mesaj / 60 saniye. Normal yazışmanın çok üstü; script selini keser.
  v_limit constant integer := 20;
  v_recent integer;
begin
  select count(*) into v_recent
  from public.messages
  where sender_user_id = new.sender_user_id
    and created_at > now() - interval '1 minute';
  if v_recent >= v_limit then
    raise exception 'Çok hızlı mesaj gönderiyorsunuz. Lütfen kısa bir süre bekleyin.';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();

-- ============================================================================
-- 2) ticket_issue — kişi başına dakikada en fazla 5 YENİ bilet (KAYAN pencere).
--    Mevcut iş kuralları (FOR UPDATE kilidi, APPROVED, ticket_enabled,
--    deadline, kapasite, çift-bilet idempotenti) AYNEN korunur; yalnız
--    idempotent erken dönüşten SONRA, insert'ten önce sayaç kontrolü eklenir
--    (bileti zaten olan kullanıcının tekrar tıklaması sessiz kalmaya devam eder).
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
  -- Hız sınırı: 5 yeni bilet / 60 saniye (etkinlikten bağımsız, kişi başına).
  v_rate_limit constant integer := 5;
  v_recent integer;
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

  -- Hız sınırı (bu migration'ın konusu): son 1 dakikadaki yeni biletler.
  select count(*) into v_recent
  from public.tickets
  where user_id = auth.uid()
    and created_at > now() - interval '1 minute';
  if v_recent >= v_rate_limit then
    raise exception 'Çok fazla deneme yaptınız. Lütfen biraz bekleyip tekrar deneyin.';
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

-- NOT (#5 kapsam sınırı): club_request_submit'e ek limit gerekmez (partial-unique
-- zaten tek bekleyen başvuruya izin veriyor). Login/kayıt sınırı Supabase Auth
-- ayarından yönetilir (uygulama katmanında bilinçli olarak dokunulmadı).
