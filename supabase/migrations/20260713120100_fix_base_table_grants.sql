-- 20260713120100_fix_base_table_grants
-- Temel tablolarda authenticated rolüne eksik SQL ayrıcalıklarını verir.
--
-- KÖK NEDEN (bkz. 20260713120000_fix_profiles_grants): Bu temiz Supabase
-- projesinde örtük default privilege'lar DML'i authenticated'a VERMEDİ. Açık
-- grant'ı olan tablolar (tickets, event_documents, events'in içerik kolonları)
-- çalışır; örtüğe güvenen temel tablolar (clubs SELECT/INSERT/DELETE + geniş
-- UPDATE, club_members tümü, events SELECT/DELETE, event_attendees tümü)
-- "permission denied" verir. Bu migration o boşlukları kapatır.
--
-- GÜVENLİK KORUNUR: Grant "hangi işlem SQL düzeyinde mümkün" der; "KİM yapabilir"
-- sorusunu RLS politikaları, hassas kolonları ise trigger'lar yönetir:
--   • prevent_advisor_change  → clubs.advisor_id / requires_advisor_approval yalnız okul
--   • prevent_unauthorized_club_admin → club_members.role='ADMIN' yalnız okul/danışman
--   • prevent_role_escalation → profiles.role
-- TRUNCATE HİÇBİR tabloya verilmez (TRUNCATE RLS'i baypas eder).
-- events'e tablo-seviyesi INSERT/UPDATE VERİLMEZ: status/review_* doğrudan
-- yazılamamalı (Faz 2). Onların içerik-kolon grant'ları event_approval +
-- ticket_column_grants'ta zaten var; durum geçişleri yalnızca RPC ile.
--
-- İDEMPOTENT: GRANT tekrar çalıştırılınca no-op'tur (mevcut kolon-grant'larla,
-- örn. clubs UPDATE(iban,ticket_enabled), çakışmaz — tablo-seviyesi onu kapsar).

-- clubs -----------------------------------------------------------------------
-- SELECT herkese açık (RLS using(true)); INSERT/DELETE yalnız okul (RLS);
-- UPDATE super/danışman/başkan (RLS) + advisor_id/requires_advisor_approval
-- prevent_advisor_change ile yalnız okul. Tablo-seviyesi UPDATE, ClubInfoForm'un
-- düzenlediği tüm içerik kolonlarını (name/category/description/vision/logo_url/
-- cover_url/iletişim/sosyal) kapsar; hassas kolonları trigger korur.
grant select, insert, update, delete on public.clubs to authenticated;

-- club_members ----------------------------------------------------------------
-- SELECT herkes (üye adları); INSERT kendisi+role='MEMBER' (RLS+WITH CHECK);
-- UPDATE (MEMBER↔ADMIN) super/danışman (RLS+trigger); DELETE kendisi/yönetim (RLS).
grant select, insert, update, delete on public.club_members to authenticated;

-- events ----------------------------------------------------------------------
-- SADECE eksik olanlar: SELECT (öğrenci APPROVED, yönetici bekleyenler — RLS) ve
-- DELETE (yönetim paneli — RLS). INSERT/UPDATE burada YOK: içerik kolonları için
-- grant'lar event_approval/ticket_column_grants'ta; status/review_* yalnız RPC.
grant select, delete on public.events to authenticated;

-- event_attendees -------------------------------------------------------------
-- SELECT herkes (katılımcı sayısı); INSERT/DELETE kendisi (RSVP — RLS). UPDATE yok.
grant select, insert, delete on public.event_attendees to authenticated;
