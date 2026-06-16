-- Faz 0 kapanışı — profiles.email gizliliği (PII/KVKK).
--
-- Sorun: profiles SELECT (RLS) oturum açmış herkese açıktı; bu da her
-- kullanıcının TÜM e-postaları okuyabilmesi demekti. İsim/rol açık kalsın
-- (üye listeleri için gerekli), yalnızca email kolonu kısıtlansın.
--
-- Yöntem: kolon seviyesinde GRANT. RLS satır görünürlüğünü yönetir; kolon
-- grant'ı hangi kolonların SELECT edilebileceğini yönetir. email kolonu
-- grant listesinde olmadığı için (satır koşulundan bağımsız olarak) hiçbir
-- authenticated kullanıcı email okuyamaz — kendi e-postası dahil. Kendi
-- e-postası uygulamada auth oturumundan (auth.getUser) alınır.
--
-- NOT: SECURITY DEFINER fonksiyonlar (is_super_admin, handle_new_user,
-- prevent_role_escalation) tablo sahibi olarak çalıştığı için bu grant'tan
-- etkilenmez. INSERT/UPDATE ayrı ayrıcalıklardır; email yazımı (register
-- upsert) çalışmaya devam eder.

-- authenticated: tablo geneli SELECT'i kaldır, yalnızca güvenli kolonları ver.
revoke select on public.profiles from authenticated;
grant select (id, full_name, role) on public.profiles to authenticated;

-- anon: profiles'ı hiç okuyamasın.
revoke select on public.profiles from anon;
