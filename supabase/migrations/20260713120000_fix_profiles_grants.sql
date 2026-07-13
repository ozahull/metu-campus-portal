-- 20260713120000_fix_profiles_grants
-- Kayıt (register) hatası düzeltmesi: "permission denied for table profiles" (INSERT).
--
-- KÖK NEDEN: profiles üzerinde authenticated rolüne INSERT/UPDATE ayrıcalığı hiç
-- verilmemiş. RLS politikaları doğru (profiles_insert_self / profiles_update_self
-- kendi satırını yazmaya izin verir), ama SQL tablo/kolon ayrıcalığı yoksa
-- PostgreSQL RLS'i değerlendirmeye BİLE geçmeden "permission denied for table
-- profiles" döndürür. 20260615120700 yalnızca SELECT'i yeniden düzenledi
-- (email'i okunamaz kıldı); INSERT/UPDATE'e dokunmadı. Bu (temiz) projede
-- Supabase'in örtük default privilege'ları DML'i authenticated'a vermediği için
-- açık grant gerekiyor.
--
-- GİZLİLİK KORUNUR: Bu migration SELECT'e DOKUNMAZ. email hâlâ OKUNAMAZ
-- (20260615120700: yalnızca id, full_name, role SELECT edilebilir). Buradaki
-- kolon grant'ları yalnızca YAZMA (INSERT/UPDATE) içindir.
--
-- KAYIT AKIŞI: handle_new_user trigger'ı (SECURITY DEFINER) signup'ta profiles
-- satırını zaten oluşturur. Client register upsert'ü
--   INSERT (id, email, full_name) ON CONFLICT (id) DO UPDATE SET email, full_name
-- ürettiğinden hem INSERT hem de (email + full_name) UPDATE ayrıcalığı gerekir.
-- Bu yüzden UPDATE grant'ı email'i de içerir — aksi halde conflict yolundaki
-- "SET email" aynı hatayı verir. email YAZMA gizlilik sorunu değildir
-- (gizlilik = OKUMA); kullanıcı RLS gereği yalnızca kendi satırını yazar.
--
-- İDEMPOTENT: GRANT tekrar çalıştırıldığında no-op'tur (hata vermez).

-- INSERT: kendi satırı (id, email, full_name). role KASITLI olarak HARİÇ tutuldu
-- (varsayılan 'USER'; INSERT'te rol yükseltme deliğini kolon seviyesinde kapatır —
-- prevent_role_escalation trigger yalnızca UPDATE'i kapsar).
grant insert (id, email, full_name) on public.profiles to authenticated;

-- UPDATE: full_name + email (upsert conflict yolu ikisini de yazar).
-- role KASITLI HARİÇ: prevent_role_escalation trigger + kolon dışı bırakma = çift koruma.
grant update (full_name, email) on public.profiles to authenticated;

-- NOT: DELETE bilinçli olarak VERİLMEZ (profil satırı auth.users silinince
-- cascade ile gider; uygulama profili doğrudan silmez).
-- NOT: SELECT'e DOKUNULMAZ — email kolonu okunamaz kalır (PII/KVKK tasarımı).
