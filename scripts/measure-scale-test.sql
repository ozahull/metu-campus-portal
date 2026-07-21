-- =====================================================================
-- ÖLÇÜM TURU — her A2 sayfası/sorgusu için EXPLAIN (ANALYZE, BUFFERS)
-- =====================================================================
-- Her blok: authenticated rolü + jwt claim (auth.uid()) ile GERÇEK RLS altında
-- ölçülür. begin/rollback ile 'set local' sıfırlanır. Süre = DB-tarafı Execution Time.
-- Kullanıcılar: 1=SUPER_ADMIN, 7=club1 danışmanı, 139=club1 başkanı, 300=düz USER.
-- Deterministik id'ler: profil ...0000-<hex>, kulüp ...0001-, etkinlik ...0002-, kanal ...0003-.
--
-- Çalıştırma:
--   docker exec -i supabase_db_ncc-campus-app psql -U postgres -d postgres < scripts/measure-scale-test.sql
-- =====================================================================
\pset pager off
\timing off

-- ---- M1: /events + /dashboard — etkinlik listesi (status+tarih) — EN SICAK SORGU
\echo '\n===== M1 events list: status=APPROVED AND event_date>=now() ORDER BY event_date (limit 200) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000012c","role":"authenticated"}';
  explain (analyze, buffers)
  select id, title, event_date, location, club_id
  from public.events
  where status = 'APPROVED' and event_date >= now()
  order by event_date asc, id asc limit 200;
rollback;

-- ---- M2: /clubs/[id] — kulübe göre etkinlikler (club_id filtresi)
\echo '\n===== M2 events by club_id (club 1) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000012c","role":"authenticated"}';
  explain (analyze, buffers)
  select id, title, description, event_date, location
  from public.events
  where club_id = '00000000-0000-0000-0001-000000000001'
  order by event_date asc, id asc limit 100;
rollback;

-- ---- M3a: event_attendees(user_id) EMBED aşırı-çekim (etkinlik 1 = 500 katılımcı)
\echo '\n===== M3a event_attendees over-fetch: ALL user_id for event 1 (embed anti-pattern) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000012c","role":"authenticated"}';
  explain (analyze, buffers)
  select event_id, user_id from public.event_attendees
  where event_id = '00000000-0000-0000-0002-000000000001';
rollback;

-- ---- M3b: aggregate alternatifi (aynı sayı, tek satır)
\echo '\n===== M3b aggregate count alternative for event 1 ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000012c","role":"authenticated"}';
  explain (analyze, buffers)
  select count(*) from public.event_attendees
  where event_id = '00000000-0000-0000-0002-000000000001';
rollback;

-- ---- M4: /clubs/[id] roster — club_members limit 500 + profiles embed (club 1 = 600 üye)
\echo '\n===== M4 club roster: club_members(role,user_id)+profiles(full_name) limit 500 — club 1 (600 members) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000012c","role":"authenticated"}';
  explain (analyze, buffers)
  select cm.role, cm.user_id, p.full_name
  from public.club_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.club_id = '00000000-0000-0000-0001-000000000001'
  limit 500;
rollback;

-- ---- M5: club_members user_id filtresi (kişi profili / is_public_profile alt-sorgusu)
\echo '\n===== M5 club_members by user_id (my-clubs / is_public_profile subquery) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000012c","role":"authenticated"}';
  explain (analyze, buffers)
  select club_id, role from public.club_members
  where user_id = '00000000-0000-0000-0000-00000000012c';
rollback;

-- ---- M6: event_attendees user_id filtresi (/profile "Katılacağım Etkinlikler")
\echo '\n===== M6 event_attendees by user_id (my RSVPs) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
  explain (analyze, buffers)
  select event_id from public.event_attendees
  where user_id = '00000000-0000-0000-0000-000000000001';
rollback;

-- ---- M7: /notifications — kullanıcı 1 (40 bildirim), 50.000 içinden
\echo '\n===== M7 notifications list for user (limit 100) from 50k table ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
  explain (analyze, buffers)
  select id, type, title, body, link, read_at, created_at
  from public.notifications
  where user_id = '00000000-0000-0000-0000-000000000001'
  order by created_at desc, id asc limit 100;
rollback;

-- ---- M8: navbar — okunmamış sayaç (HER sayfa render'ında) 50k tablo
\echo '\n===== M8 navbar unread count on 50k notifications (every page render) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
  explain (analyze, buffers)
  select count(*) from public.notifications
  where user_id = '00000000-0000-0000-0000-000000000001' and read_at is null;
rollback;

-- ---- M9: /messages/[id] — kanal 1 (530 mesaj), RLS can_access_conversation SATIR BAŞINA
\echo '\n===== M9 messages thread (limit 201) with RLS can_access_conversation per row — channel 1 (530 msgs), as president 139 ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000008b","role":"authenticated"}';
  explain (analyze, buffers)
  select id, sender_user_id, body, created_at
  from public.messages
  where conversation_id = '00000000-0000-0000-0003-000000000001'
  order by created_at desc, id asc limit 201;
rollback;

-- ---- M10a: kişi arama RPC (ILIKE, 5000 profil) — search_public_profiles
\echo '\n===== M10a search_public_profiles RPC (ILIKE over 5000 profiles) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000012c","role":"authenticated"}';
  explain (analyze, buffers)
  select * from public.search_public_profiles('ay');
rollback;

-- ---- M10b: aynı aramanın çıplak ILIKE'ı (seq scan'i doğrudan gösterir)
\echo '\n===== M10b raw ILIKE on profiles.full_name (shows seq scan; no trigram index) ====='
begin;
  set local role postgres;
  explain (analyze, buffers)
  select id, full_name from public.profiles where full_name ilike '%ay%';
rollback;

-- ---- M11: /messages inbox — list_my_conversations RPC (başkan 139)
\echo '\n===== M11 list_my_conversations RPC (president 139) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000008b","role":"authenticated"}';
  explain (analyze, buffers)
  select * from public.list_my_conversations();
rollback;

-- ---- M12: /admin — profiles limit 500 (5000 kullanıcı → atama dropdown'ları)
\echo '\n===== M12 admin profiles list limit 500 over 5000 users (assignment dropdowns) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
  explain (analyze, buffers)
  select id, full_name, role from public.profiles
  order by full_name asc, id asc limit 500;
rollback;

-- ---- M13: analytics_overview RPC (SUPER_ADMIN) — kampüs özeti
\echo '\n===== M13 analytics_overview RPC (super admin) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
  explain (analyze, buffers)
  select public.analytics_overview();
rollback;

-- ---- M14: event_attendance_counts RPC — dashboard 8 etkinlik toplu sayım
\echo '\n===== M14 event_attendance_counts RPC for 8 dashboard events (batch aggregate) ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000012c","role":"authenticated"}';
  explain (analyze, buffers)
  select * from public.event_attendance_counts(array[
    '00000000-0000-0000-0002-000000000001','00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0002-000000000003','00000000-0000-0000-0002-000000000004',
    '00000000-0000-0000-0002-000000000005','00000000-0000-0000-0002-000000000006',
    '00000000-0000-0000-0002-000000000007','00000000-0000-0000-0002-000000000008']::uuid[]);
rollback;

-- ---- M15: mesaj hız-sınırı trigger'ının iç sorgusu (sender_user_id, indexsiz)
\echo '\n===== M15 message rate-limit internal count(*) — sender_user_id (no index) over 6354 msgs ====='
begin;
  set local role postgres;
  explain (analyze, buffers)
  select count(*) from public.messages
  where sender_user_id = '00000000-0000-0000-0000-000000000007'
    and created_at > now() - interval '1 minute';
rollback;

-- ---- M16: /tickets — kullanıcının biletleri (unbounded), tickets_user_idx var mı?
\echo '\n===== M16 /tickets — user tickets (unbounded) with nested event->club embed shape ====='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}';
  explain (analyze, buffers)
  select id, token, status, event_id from public.tickets
  where user_id = '00000000-0000-0000-0000-000000000007';
rollback;

\echo '\n===== ÖLÇÜM TAMAM ====='
