-- =====================================================================
-- ODTÜ KKK Portal — ÖLÇEK TESTİ SENTETİK VERİ ÜRETİCİSİ (tekrarlanabilir)
-- =====================================================================
-- AMAÇ: ~10.000 günlük kullanıcı profiline yakın gerçekçi hacim üretip
-- sorgu ölçeklenmesini (index/seq-scan/RLS maliyeti) ölçmek.
--
-- ⚠️ YALNIZCA YEREL / İZOLE test veritabanında çalıştır. CANLI (zmnmdcuvdrvgdkdcaxjj)
--    üzerinde ASLA çalıştırma — bu script veriyi TRUNCATE ile SİLER.
--
-- ÇALIŞTIRMA (yerel Supabase, Docker açıkken):
--   docker exec -i supabase_db_ncc-campus-app \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < scripts/seed-scale-test.sql
--   (veya scripts/run-scale-test.ps1)
--
-- TASARIM NOTLARI:
--  * session_replication_role=replica → trigger + FK doğrulaması KAPALI (hızlı,
--    idempotent bulk seed). CHECK / NOT NULL / UNIQUE kısıtları YİNE geçerlidir.
--  * auth.users'a DOKUNULMAZ. Profiller doğrudan public.profiles'a yazılır; RLS
--    ölçümünde auth.uid() jwt claim ile taklit edilir (bkz. scripts/measure-*.sql).
--  * Deterministik UUID şeması (yeniden çalıştırınca aynı id'ler):
--      profil : 00000000-0000-0000-0000-<n:12hex>
--      kulüp  : 00000000-0000-0000-0001-<n:12hex>
--      etkinl.: 00000000-0000-0000-0002-<n:12hex>
--      kanal  : 00000000-0000-0000-0003-<n:12hex>
--
-- HEDEF HACİMLER (soru setinden): 5.000 kullanıcı, 150 kulüp, 1.000 etkinlik,
--   ~20.000 katılım + biletler, 50.000 bildirim, ~13.000 kulüp üyeliği (aşağıdaki
--   NOT'a bak), 100 mesaj kanalı (~6.500 mesaj; birkaçı 500+).
--
-- NOT — "2.000 kulüp üyeliği" hedefi KASITLI OLARAK AŞILDI: 150 kulüp × en az
--   20 üye + "birkaç kulüp 500+ üyeli" koşulu 2.000'e SIĞMAZ (matematiksel çelişki).
--   Gerçekçi uzun-kuyruk dağılım (~13.000 üyelik) seçildi; en büyük 3 kulüp 600/700/800
--   üyeli → /clubs/[id] "500+ üyeli" ölçüm hedefi karşılanır. (Rapordaki A5'te belirtildi.)
-- =====================================================================

\set ON_ERROR_STOP on
begin;

set local session_replication_role = replica;   -- trigger + FK OFF (seed hızı)
set local statement_timeout = 0;

-- Deterministik UUID üreticileri (oturum-yerel; otomatik düşer)
create or replace function pg_temp.pid(n int)  returns uuid language sql immutable as
  $$ select ('00000000-0000-0000-0000-'||lpad(to_hex(n),12,'0'))::uuid $$;
create or replace function pg_temp.cid(n int)  returns uuid language sql immutable as
  $$ select ('00000000-0000-0000-0001-'||lpad(to_hex(n),12,'0'))::uuid $$;
create or replace function pg_temp.eid(n int)  returns uuid language sql immutable as
  $$ select ('00000000-0000-0000-0002-'||lpad(to_hex(n),12,'0'))::uuid $$;
create or replace function pg_temp.vid(n int)  returns uuid language sql immutable as
  $$ select ('00000000-0000-0000-0003-'||lpad(to_hex(n),12,'0'))::uuid $$;

-- Temiz başlangıç (tekrarlanabilirlik). Cascade: seed edilen tüm public tabloları temizler.
truncate table
  public.notifications, public.messages, public.conversations, public.tickets,
  public.event_attendees, public.event_photos, public.user_badges,
  public.club_members, public.events, public.clubs, public.profiles
  restart identity cascade;

-- ---------------------------------------------------------------------
-- 1) PROFILLER — 5.000 (5 SUPER_ADMIN, 250 ADVISOR, kalan USER)
-- ---------------------------------------------------------------------
insert into public.profiles (id, full_name, email, role, department, class_year, name_verified, hide_profile, bio)
select
  pg_temp.pid(n),
  (array['Ahmet','Mehmet','Ayşe','Fatma','Mustafa','Ali','Zeynep','Elif','Can','Deniz',
         'Ece','Emre','Burak','Cem','Selin','Merve','Kaan','Ozan','Buse','Yusuf'])[1+(n%20)]
    || ' ' ||
  (array['Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Yıldırım','Öztürk','Aydın','Arslan',
         'Doğan','Kılıç','Aslan','Çetin','Kara','Koç','Kurt','Özdemir','Şimşek','Polat'])[1+((n/20)%20)],
  'student'||n||'@metu.edu.tr',
  case when n<=5 then 'SUPER_ADMIN' when n<=255 then 'ADVISOR' else 'USER' end,
  (array['Bilgisayar Müh.','Elektrik-Elektronik','Makine Müh.','Endüstri Müh.','Fizik','Matematik',
         'İşletme','Mimarlık','Psikoloji','Kimya','Uluslararası İlişkiler','İnşaat Müh.'])[1+(n%12)],
  (array['1','2','3','4','Hazırlık','YL','DR'])[1+(n%7)],
  (n%3=0),
  (n%20=0),
  case when n%4=0 then 'ODTÜ öğrencisi. Kısa örnek bio metni.' else null end
from generate_series(1,5000) n;

-- ---------------------------------------------------------------------
-- 2) KULÜPLER — 150 (her birine bir danışman: advisor id 7..156)
-- ---------------------------------------------------------------------
insert into public.clubs (id, name, description, advisor_id, vision, category,
                          ticket_enabled, requires_advisor_approval)
select
  pg_temp.cid(c),
  (array['ODTÜ ','METU ',''])[1+(c%3)] ||
  (array['Bilgisayar','Müzik','Dağcılık','Fotoğrafçılık','Robotik','Tiyatro','Havacılık',
         'Satranç','Girişimcilik','Doğa Sporları'])[1+(c%10)] || ' Topluluğu #'||c,
  'Örnek kulüp açıklaması. Uzunca bir metin gövdesi buraya gelir.',
  pg_temp.pid(6 + (c % 250)),
  'Kampüste örnek bir vizyon metni.',
  (array['Teknoloji','Sanat','Spor','Kültür','Bilim','Sosyal'])[1+(c%6)],
  (c%3=0),          -- ~%33 biletli kulüp
  (c%2=0)
from generate_series(1,150) c;

-- ---------------------------------------------------------------------
-- 3) KULÜP ÜYELİKLERİ — uzun kuyruk (~13.000). En büyük 3 kulüp: 600/700/800.
--    Kulüp 1..100'ün ilk üyesi BAŞKAN (role=ADMIN → 100 başkan, ~%2).
-- ---------------------------------------------------------------------
insert into public.club_members (club_id, user_id, role, created_at)
select
  pg_temp.cid(sz.c),
  pg_temp.pid(((sz.c*137 + g) % 5000) + 1),
  case when g=1 and sz.c<=100 then 'ADMIN' else 'MEMBER' end,
  now() - ((g % 300) || ' days')::interval
from (
  select c,
    case when c<=3  then 500 + c*100        -- 600, 700, 800  (500+ üyeli stres)
         when c<=25 then 100 + c*8          -- ~132..300
         else 20 + (c % 80) end as size     -- 20..99
  from generate_series(1,150) c
) sz
cross join lateral generate_series(1, sz.size) g;

-- ---------------------------------------------------------------------
-- 4) ETKİNLİKLER — 1.000 (geçmiş+gelecek karışık; ~%90 APPROVED; ~%33 biletli).
--    Etkinlik 1: gelecek, APPROVED, 500 katılımcı hedefi (bkz. §6).
-- ---------------------------------------------------------------------
insert into public.events (id, club_id, title, description, event_date, location, status,
                          ticket_capacity, ticket_deadline)
select
  id, club_id, title, description, event_date, location, status, ticket_capacity,
  -- CHECK: ticket_deadline <= event_date (etkinlikten 1 gün önce son başvuru)
  case when ticket_capacity is not null then event_date - interval '1 day' else null end
from (
  select
    pg_temp.eid(n) as id,
    pg_temp.cid(((n-1)%150)+1) as club_id,
    'Etkinlik #'||n||' — '||
      (array['Söyleşi','Workshop','Konser','Turnuva','Gezi','Panel','Film Gösterimi','Hackathon'])[1+(n%8)] as title,
    'Etkinlik açıklaması. Detaylı bir paragraf metni buraya gelir.' as description,
    now() + (((n%361)-180) || ' days')::interval + ((n%24) || ' hours')::interval as event_date,
    (array['MM-25','BMB-1','Kültür ve Kongre Merkezi','Vişnelik','A-101','Devrim Stadyumu'])[1+(n%6)] as location,
    case
      when n=1 then 'APPROVED'
      when n%10=0 then (array['PENDING_SCHOOL','PENDING_ADVISOR','REJECTED','CHANGES_REQUESTED'])[1+((n/10)%4)]
      else 'APPROVED'
    end as status,
    case when (((n-1)%150)+1)%3=0 then 100 + (n%400) else null end as ticket_capacity  -- biletli kulüp etkinlikleri
  from generate_series(1,1000) n
) e;

-- ---------------------------------------------------------------------
-- 5) ETKİNLİK KATILIMLARI (RSVP) — ~20.000. Etkinlik 1 = 500 katılımcı.
-- ---------------------------------------------------------------------
insert into public.event_attendees (event_id, user_id, created_at)
select
  pg_temp.eid(x.e),
  pg_temp.pid(((x.e*991 + g) % 5000) + 1),
  now() - ((g % 60) || ' days')::interval
from (
  select e, case when e=1 then 500 else 8 + (e % 25) end as cnt
  from generate_series(1,1000) e
) x
cross join lateral generate_series(1, x.cnt) g;

-- ---------------------------------------------------------------------
-- 6) BİLETLER — biletli kulüp etkinlikleri. Etkinlik 3: 450 bilet (kapı/check-in stres).
--    token deterministik (md5 → 10 hex, UNIQUE korunur). ~%20 CHECKED_IN.
-- ---------------------------------------------------------------------
insert into public.tickets (event_id, user_id, token, status)
select
  pg_temp.eid(x.e),
  pg_temp.pid(((x.e*877 + g) % 5000) + 1),
  upper(substr(md5(x.e::text||'-'||g::text), 1, 10)),
  case when g%5=0 then 'CHECKED_IN' else 'APPROVED' end
from (
  select e,
    case when e=3 then 450
         when (((e-1)%150)+1)%3=0 then 20 + (e % 60)
         else 0 end as cnt
  from generate_series(1,1000) e
) x
cross join lateral generate_series(1, x.cnt) g
where x.cnt > 0;

-- ---------------------------------------------------------------------
-- 7) BİLDİRİMLER — 50.000. Kullanıcı 1: 40 adet (ağır kullanıcı ölçümü). ~%40 okunmamış.
-- ---------------------------------------------------------------------
insert into public.notifications (user_id, type, title, body, link, created_at, read_at)
select
  pg_temp.pid(case when n<=40 then 1 else ((n*13) % 5000) + 1 end),
  (array['EVENT_APPROVED','EVENT_NEW','CLUB_ANNOUNCEMENT','MEMBERSHIP','MESSAGE'])[1+(n%5)],
  'Bildirim başlığı #'||n,
  case when n%2=0 then 'Bildirim gövde metni örneği.' else null end,
  '/events/'||(((n%1000)+1)),
  now() - ((n%90) || ' days')::interval - ((n%24) || ' hours')::interval,
  case when (n%5)<2 then null else now() - ((n%80) || ' days')::interval end
from generate_series(1,50000) n;

-- ---------------------------------------------------------------------
-- 8) MESAJ KANALLARI + MESAJLAR — 100 kanal (ADVISOR_PRESIDENT), ~6.500 mesaj.
--    Kanal 1..3: 500+ mesaj (thread stres). Gönderen = kulübün danışmanı veya başkanı.
-- ---------------------------------------------------------------------
insert into public.conversations (id, type, club_id, created_at)
select pg_temp.vid(c), 'ADVISOR_PRESIDENT', pg_temp.cid(c), now() - (c || ' days')::interval
from generate_series(1,100) c;

insert into public.messages (conversation_id, sender_user_id, body, created_at)
select
  pg_temp.vid(x.c),
  pg_temp.pid(case when g%2=0 then ((x.c*137 + 1) % 5000) + 1   -- başkan (kulübün ilk üyesi)
                   else 6 + (x.c % 250) end),                    -- danışman (profil 7..156)
  'Mesaj #'||g||' — kanal '||x.c||' örnek içerik metni.',
  now() - ((x.c*600 - g) || ' minutes')::interval
from (
  select c, case when c<=3 then 500 + c*30 else 30 + (c % 40) end as cnt
  from generate_series(1,100) c
) x
cross join lateral generate_series(1, x.cnt) g;

-- ---------------------------------------------------------------------
-- 9) ROZETLER (opsiyonel, hafif) — roster rozet sorgusunu boş bırakmamak için.
--    badges tablosunda kod varsa ilk kodu ~1.500 kullanıcıya ver.
-- ---------------------------------------------------------------------
insert into public.user_badges (user_id, badge_code)
select pg_temp.pid(n), b.code
from generate_series(1,1500) n
cross join lateral (select code from public.badges order by sort_order limit 1) b
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 10) ETKİNLİK FOTOĞRAFLARI (hafif) — kulüp/etkinlik detay foto sorgusu için.
-- ---------------------------------------------------------------------
insert into public.event_photos (event_id, uploader_id, storage_path, created_at)
select
  pg_temp.eid(e),
  pg_temp.pid(((e*991 + 1) % 5000) + 1),
  e||'/'||g||'-seed.jpg',
  now() - (g || ' days')::interval
from generate_series(1,100) e
cross join lateral generate_series(1,5) g;

commit;

-- ---------------------------------------------------------------------
-- ÖZET SAYIMLAR
-- ---------------------------------------------------------------------
select 'profiles'         as tablo, count(*) from public.profiles
union all select 'clubs',            count(*) from public.clubs
union all select 'club_members',     count(*) from public.club_members
union all select 'events',           count(*) from public.events
union all select 'event_attendees',  count(*) from public.event_attendees
union all select 'tickets',          count(*) from public.tickets
union all select 'notifications',    count(*) from public.notifications
union all select 'conversations',    count(*) from public.conversations
union all select 'messages',         count(*) from public.messages
union all select 'user_badges',      count(*) from public.user_badges
union all select 'event_photos',     count(*) from public.event_photos;
