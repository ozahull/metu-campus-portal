-- 20260713190000_tighten_profiles_grants
-- Canlı DB'de profiles üzerinde authenticated'a tasarımdan GENİŞ yazma
-- ayrıcalıkları tespit edildi: INSERT role, UPDATE id/role (muhtemelen debug
-- sırasında SQL Editor'den verilen tablo-seviyesi grant kalıntısı).
-- 20260713120000'deki tasarıma geri daraltır: INSERT (id, email, full_name),
-- UPDATE (full_name, email). role hiçbir yazma yolunda yer almaz
-- (prevent_role_escalation trigger'ı + kolon dışı bırakma = çift koruma).
-- SELECT'e DOKUNULMAZ (email gizliliği korunur). İdempotent.

revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;

grant insert (id, email, full_name) on public.profiles to authenticated;
grant update (full_name, email) on public.profiles to authenticated;