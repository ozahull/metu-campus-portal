-- 20260719230000_announce_link_allowlist
-- GÜVENLİK SERTLEŞTİRME #4 — bildirim linki allow-list (katman 1/3: DB).
--
-- club_announce serbest metin p_link kabul ediyordu; sw.js openWindow ve
-- notification-bell router.push bu linke gidebildiğinden, güvenilir "portaldan
-- geldi" görünümüyle kulübün tüm üyelerine phishing linki dağıtılabilirdi
-- (//evil.com protokol-göreli biçimi isExternalLink'in ^https?:// kalıbından
-- kaçıyordu). Kural: link ya TEK / ile başlayan uygulama içi yol ('//' ve '/\'
-- yasak — tarayıcılar '/\'yi '//' gibi yorumlar), ya da https + izinli host
-- (instagram.com, wa.me, chat.whatsapp.com, metu.edu.tr ve alt alanları).
--
-- İdempotent: create or replace + koşullu UPDATE (temizlik yeniden çalışsa etkisiz).

-- ============================================================================
-- 1) is_safe_notification_link — hem RPC doğrulaması hem mevcut veri temizliği
--    kullanır. Host, authority'yi ilk / ? # karakterine kadar alan regex'le
--    çıkarılır; '@' ve ':' karakter sınıfında OLMADIĞINDAN userinfo/port
--    hileleri (https://instagram.com@evil.com) otomatik reddedilir.
-- ============================================================================
create or replace function public.is_safe_notification_link(p_link text)
returns boolean
language sql
immutable
as $$
  select case
    -- Uygulama içi yol: tek / ile başlar; '//' (protokol-göreli) ve '/\' yasak.
    when left(p_link, 1) = '/'
         and left(p_link, 2) not in ('//', '/\') then true
    -- İzinli https host'ları (tam eşleşme) + metu.edu.tr alt alanları.
    when lower(coalesce(
           substring(p_link from '^https://([A-Za-z0-9.-]+)(?:[/?#]|$)'), ''))
         in ('instagram.com', 'www.instagram.com', 'wa.me',
             'chat.whatsapp.com', 'metu.edu.tr') then true
    when lower(coalesce(
           substring(p_link from '^https://([A-Za-z0-9.-]+)(?:[/?#]|$)'), ''))
         like '%.metu.edu.tr' then true
    else false
  end;
$$;

grant execute on function public.is_safe_notification_link(text) to authenticated;

-- ============================================================================
-- 2) club_announce — p_link doğrulaması eklendi; yetki/limit/fanout AYNEN.
--    (Saatlik 3 duyuru penceresi zaten KAYAN: created_at > now()-'1 hour'.)
-- ============================================================================
create or replace function public.club_announce(
  p_club_id uuid,
  p_title text,
  p_body text,
  p_link text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent integer;
  v_count integer;
  v_link_input text;
  v_link text;
begin
  -- Yetki: yalnız başkan / danışman / okul
  if not (
       public.is_super_admin()
       or public.is_club_admin(p_club_id)
       or public.is_club_advisor(p_club_id)
     ) then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;

  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_body), '') = '' then
    raise exception 'Başlık ve mesaj gerekli.';
  end if;

  -- Link allow-list (bu migration'ın konusu): geçersiz biçim/host reddedilir.
  v_link_input := nullif(btrim(p_link), '');
  if v_link_input is not null
     and not public.is_safe_notification_link(v_link_input) then
    raise exception 'Geçersiz bağlantı: yalnızca uygulama içi bir yol (/...) ya da izinli bir site (Instagram, WhatsApp, metu.edu.tr) linki verilebilir.';
  end if;

  -- Spam koruması: aynı kulüpten son 1 saatte en fazla 3 duyuru (KAYAN pencere).
  select count(distinct created_at) into v_recent
  from public.notifications
  where club_id = p_club_id
    and type = 'CLUB_ANNOUNCEMENT'
    and created_at > now() - interval '1 hour';
  if v_recent >= 3 then
    raise exception 'Son bir saatte en fazla 3 duyuru gönderebilirsiniz.';
  end if;

  v_link := coalesce(v_link_input, '/clubs/' || p_club_id::text);

  -- Tüm üyelere (gönderen hariç, tercihe saygı ile) duyuru bildirimi üret.
  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  select m.user_id, 'CLUB_ANNOUNCEMENT', btrim(p_title), btrim(p_body), v_link, p_club_id, null
  from public.club_members m
  where m.club_id = p_club_id
    and m.user_id <> auth.uid()
    and public.user_wants_notification(m.user_id, p_club_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.club_announce(uuid, text, text, text) to authenticated;

-- ============================================================================
-- 3) MEVCUT VERİ temizliği: kuralı ihlal eden linkler zararsız iç hedefe çekilir
--    (kulüp sayfası > etkinlik sayfası > bildirim listesi). İdempotent: güvenli
--    linkler koşula takılmaz, ikinci çalıştırma 0 satır günceller.
-- ============================================================================
update public.notifications
   set link = case
     when club_id is not null then '/clubs/' || club_id::text
     when event_id is not null then '/events/' || event_id::text
     else '/notifications'
   end
 where link is not null
   and not public.is_safe_notification_link(link);
