-- 20260721130000_scale_indexes
-- ÖLÇEK — eksik index'ler (ölçek testi raporu §5.1, docs/olcek-testi-raporu.md).
-- Bu index'ler atılabilir yerel test DB'sinde denendi; before/after ölçüldü
-- (kanıtlar aşağıda). Bu tur canlıya UYGULANIR (migration'ı SEN çalıştıracaksın).
--
-- Tam idempotent: create extension / create index HEPSİ "if not exists". Yeniden
-- çalıştırma güvenli. CONCURRENTLY KULLANILMAZ (migration tek transaction'da
-- koşar; CONCURRENTLY transaction içinde çalışmaz). Tablolar şu an küçük →
-- kilit süresi ihmal edilebilir.
--
-- ⚠️ pg_trgm — Supabase'de uzantılar "extensions" ŞEMASINDA kurulur (pgcrypto
-- emsali; CLAUDE.md ALTYAPI DURUMU). Bu yüzden opclass `gin_trgm_ops` da
-- `extensions.gin_trgm_ops` diye NİTELENİR — aksi halde search_path'te bulunmaz
-- ve "operator class ... does not exist" (42704) hatası verir.

-- ============================================================================
-- 1) pg_trgm — kişi araması `full_name ILIKE '%q%'` için trigram desteği.
-- ============================================================================
create extension if not exists pg_trgm with schema extensions;

-- ============================================================================
-- 2) Index'ler — her biri raporda ölçülen bir darboğaza karşılık gelir.
-- ============================================================================

-- M10 (KRİTİK): navbar kişi araması + AdminUserPicker `full_name ILIKE '%q%'`.
-- GIN trigram → 50k profilde bile hızlı (ILIKE seq-scan yerine index).
create index if not exists profiles_full_name_trgm_idx
  on public.profiles using gin (full_name extensions.gin_trgm_ops);

-- M5 / S1 (KRİTİK çarpan): club_members(user_id). PK (club_id,user_id) user_id'yi
-- TEK BAŞINA index'lemez → is_public_profile / "kulüplerim" / user_wants_notification
-- seq-scan yapıyordu (M10'u 292 ms'ye çıkaran asıl neden). Ölçüldü: 0.50→0.060 ms (8×).
create index if not exists club_members_user_idx
  on public.club_members (user_id);

-- M6: event_attendees(user_id). PK (event_id,user_id) → "katılacağım etkinlikler"
-- 20k satır tarıyordu. Ölçüldü: 0.87→0.034 ms (25×).
create index if not exists event_attendees_user_idx
  on public.event_attendees (user_id);

-- M1: events(status, event_date) — dashboard + /events her yüklemede en sıcak
-- sorgu; events'te PK dışında index YOKTU → tam tablo taraması.
create index if not exists events_status_date_idx
  on public.events (status, event_date);

-- M2: events(club_id) — kulüp detayında etkinlik listesi. FK Postgres'te
-- otomatik index'lenmez.
create index if not exists events_club_idx
  on public.events (club_id);

-- S9: messages(sender_user_id, created_at) — mesaj hız-sınırı `count(*) where
-- sender_user_id=? and created_at>...`. messages'ta yalnız (conversation_id,
-- created_at) index'i vardı; gönderen bazlı sayım seq-scan'e düşüyordu.
create index if not exists messages_sender_created_idx
  on public.messages (sender_user_id, created_at);

-- ============================================================================
-- 3) notifications — /notifications cursor sayfalama (ffbd122). CANLIDA elle
--    oluşturulup DOĞRULANDI; db push'ta no-op geçer. Dosyada olmaları
--    branch/replay/yeniden kurulum parity'si için ŞART.
--
--    İSİMLER canlıyla BİREBİR (idx_ öneki) — farklı adla yazarsak "if not exists"
--    canlıda YENİ (kopya) index yaratırdı; no-op olması için ad da eşleşmeli.
--
--    idx_notifications_user_created_id: (user_id, created_at desc, id) — cursor'u
--    (created_at,id) TAM kapsar (20260714120000'deki *_created_idx id İÇERMEZ →
--    keyset için bu daha uygun). unread index'i 20260714120000'dekiyle örtüşür;
--    canlı parity için ad'ıyla korunur (zararsız).
-- ============================================================================
create index if not exists idx_notifications_user_created_id
  on public.notifications (user_id, created_at desc, id);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id)
  where read_at is null;
