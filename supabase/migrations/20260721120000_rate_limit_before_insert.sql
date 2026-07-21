-- 20260721120000_rate_limit_before_insert
-- MESAJ HIZ SINIRI — TRIGGER ZAMANLAMASI DÜZELTMESİ (canlı DB tanısı).
--
-- TANI (canlı DB'den okunan trigger tanımıyla doğrulandı):
--   enforce_message_rate_limit() FONKSİYONU doğru (eşik okuma + v_sender NULL
--   koruması + kayan-pencere sayacı + karşılaştırma sağlam). Sorun TRIGGER
--   ZAMANLAMASINDAYDI: canlıdaki messages_rate_limit AFTER INSERT çalışıyordu.
--   PostgREST her mesajı AYRI transaction'da yazdığından AFTER INSERT sayacı
--   güvenilmez davranıyor ve eşik pratikte tetiklenmiyordu (KANIT: eşik=3 iken
--   bir kanala 5 mesaj gönderildi, 5/5 geçti — 201 Created, hız-sınırı hatası
--   çıkmadı).
--
--   NOT (repo↔canlı senkron): repodaki 20260719240000 + 20260720120000
--   migration'ları messages_rate_limit'i ZATEN `before insert` ilan ediyor;
--   ancak bu iki migration canlıya HENÜZ uygulanmamıştı (db push bekliyordu),
--   dolayısıyla canlıdaki trigger repodan geride/yanlış zamanlıydı. Bu migration
--   KENDİ KENDİNE YETERLİDİR: yalnızca bu dosya uygulansa bile (app_settings
--   anahtarı + fonksiyon + trigger) mesaj hız sınırı canlıda KESİN ve DOĞRU
--   zamanlamayla (BEFORE INSERT) devreye girer.
--
-- DÜZELTME: messages_rate_limit BEFORE INSERT'e çevrilir. BEFORE bağlamında yeni
--   satır HENÜZ tabloda olmadığından, sayaç "son 1 dakikadaki MEVCUT (önceki)
--   mesaj sayısını" saf ölçer; bu sayı eşiğe ULAŞMIŞSA (>=) yeni gelen mesaj
--   (eşiği aşacak olan) reddedilir ve HİÇ yazılmaz.
--
-- DİĞER HIZ SINIRLARI (denetlendi — bu migration'da DEĞİŞMEDİ):
--   • ticket_issue (5 yeni bilet / dk): TRIGGER DEĞİL, SECURITY DEFINER RPC.
--     Sayaç (select count(*) ... where user_id=auth.uid() and created_at >
--     now()-'1 minute') insert'TEN ÖNCE çalışır → mevcut/önceki biletleri sayar,
--     yeni bileti saymaz. Yapısal olarak "BEFORE" desenidir; AFTER-INSERT hatası
--     TAŞIMAZ. Dokunulmadı (son sürüm: 20260719240000_rate_limits.sql).
--   • club_announce (3 duyuru / saat): TRIGGER DEĞİL, SECURITY DEFINER RPC.
--     Sayaç (select count(distinct created_at) ... where type='CLUB_ANNOUNCEMENT'
--     and created_at > now()-'1 hour') notifications insert'İNDEN ÖNCE çalışır →
--     önceki duyuruları sayar. Yapısal olarak "BEFORE" desenidir; AFTER-INSERT
--     hatası TAŞIMAZ. Dokunulmadı (son sürüm: 20260719230000_announce_link_allowlist.sql).
--   Sonuç: zaman-pencereli AFTER/BEFORE hatası YALNIZ trigger-tabanlı mesaj
--   sınırındaydı; iki RPC sınırı sayımı zaten yazımdan önce yaptığı için sağlamdı.
--
-- İdempotent: insert ... on conflict do nothing + create or replace + drop trigger if exists.

-- ============================================================================
-- 1) Tunable eşik anahtarı — kendi kendine yeterlilik için burada da seed'lenir.
--    (20260720120000 uygulanmadıysa da doğrulama `update app_settings set
--    value='3' ...` satırı bir satırı hedefleyebilsin; uygulandıysa no-op.)
-- ============================================================================
insert into public.app_settings (key, value)
values ('message_rate_per_min', '20')
on conflict (key) do nothing;

-- ============================================================================
-- 2) enforce_message_rate_limit — gövde AYNEN korunur (tunable eşik + defansif
--    v_sender). BEFORE bağlamına uygunluğu yorumlarla netleştirildi.
-- ============================================================================
create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_recent integer;
  -- Defansif: kolon DEFAULT'ları BEFORE INSERT trigger'ından ÖNCE uygulandığından
  -- new.sender_user_id burada zaten auth.uid() ile doludur (ayrıca messages_insert
  -- RLS'i `sender_user_id = auth.uid()` doğrular). Yine de NULL gelirse oturum
  -- sahibine düş — sayaç asla "kimliksiz" satırlar üzerinden boşa saymasın.
  v_sender uuid := coalesce(new.sender_user_id, auth.uid());
begin
  -- Eşik app_settings'ten; rakam-dışı/boş/geçersiz değerde 20'ye düşer.
  select nullif(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '')::int
    into v_limit
  from public.app_settings
  where key = 'message_rate_per_min';
  v_limit := coalesce(v_limit, 20);
  if v_limit <= 0 then
    v_limit := 20;
  end if;

  -- BEFORE INSERT: yeni satır HENÜZ tabloda değil → v_recent yalnızca ÖNCEKİ
  -- (bu gönderene ait, son 1 dakikadaki) mesajları sayar; yeni mesajı SAYMAZ.
  select count(*) into v_recent
  from public.messages
  where sender_user_id = v_sender
    and created_at > now() - interval '1 minute';

  -- Eşit VE aşan durumda reddet: v_recent zaten v_limit mesaj (=limit) içeriyorsa,
  -- şu an gelen mesaj (limit+1)inci olacağından yazılmamalı. Bu yüzden `>=`
  -- (`>` olsaydı limit+1 mesaja izin verir, sınırı 1 fazla kaçırırdık).
  if v_recent >= v_limit then
    raise exception 'Çok hızlı mesaj gönderiyorsunuz. Lütfen kısa bir süre bekleyin.';
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 3) Trigger'ı BEFORE INSERT olarak yeniden ilan et (asıl DÜZELTME).
--    DROP IF EXISTS + yeniden yarat → canlıda AFTER INSERT/eksik/pasif ne olursa
--    olsun apply sonrası KESİN "before insert" olur. (messages_notify AYRI bir
--    trigger olarak `after insert`'te kalır; başarısız/limitlenen insert hiç
--    yazılmadığından bildirim de üretilmez — istenen davranış.)
-- ============================================================================
drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();

-- ============================================================================
-- DOĞRULAMA (bu migration UYGULANDIKTAN sonra SQL Editor'da çalıştırın)
-- ----------------------------------------------------------------------------
-- Hazırlık — eşiği geçici 3 yap:
--   update public.app_settings set value = '3' where key = 'message_rate_per_min';
--
-- ⚠️ SQL Editor'da auth.uid() NULL döner (postgres rolü) + messages.sender_user_id
--    NOT NULL. Bu yüzden test insert'lerinde sender_user_id'yi AÇIKÇA gerçek bir
--    profil id'siyle verin (coalesce'a bel bağlamayın). Geçerli bir conversation_id
--    de gerekir. Örnekte :sender ve :conv yer tutucularını doldurun:
--
--   -- SENARYO 1 — TEK transaction'da 4 insert (aynı sender, aynı dakika):
--   begin;
--     insert into public.messages (conversation_id, sender_user_id, body)
--     values (:conv, :sender, 'm1'), (:conv, :sender, 'm2'),
--            (:conv, :sender, 'm3'), (:conv, :sender, 'm4');
--   commit;
--   BEKLENEN: 4. satırda "Çok hızlı mesaj gönderiyorsunuz..." hatası; tüm
--   transaction GERİ ALINIR → HİÇBİRİ (m1..m4) yazılmaz. (BEFORE trigger: m4
--   eklenirken önceki 3 satır aynı txn içinde görünür → v_recent=3 >= 3 → raise.)
--
--   -- SENARYO 2 — 4 AYRI çalıştırma (4 ayrı transaction, hızlı ardışık):
--   insert into public.messages (conversation_id, sender_user_id, body) values (:conv, :sender, 'a1');
--   insert into public.messages (conversation_id, sender_user_id, body) values (:conv, :sender, 'a2');
--   insert into public.messages (conversation_id, sender_user_id, body) values (:conv, :sender, 'a3');
--   insert into public.messages (conversation_id, sender_user_id, body) values (:conv, :sender, 'a4');
--   BEKLENEN: ilk 3 (a1,a2,a3) YAZILIR; 4.'de (a4) "Çok hızlı mesaj..." hatası,
--   o transaction geri alınır → a4 yazılmaz. (Her txn önceki commit'li mesajları
--   sayar: 0<3, 1<3, 2<3 geçer; 3>=3 reddedilir.)
--
-- Temizlik — eşiği 20'ye geri al (+ test mesajlarını silin):
--   update public.app_settings set value = '20' where key = 'message_rate_per_min';
--   delete from public.messages where conversation_id = :conv and sender_user_id = :sender
--     and body in ('a1','a2','a3');
-- ============================================================================
