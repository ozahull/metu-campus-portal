-- 20260715120000_fix_advisor_assignment
-- BUG 1 (KRİTİK) — Danışman ataması kaydolmuyor (kalıcı olmuyor).
--
-- BELİRTİ: /admin → Atamalar → kulüp + danışman seç → "Danışmanı Kaydet".
-- Hata yok ama reload sonrası atama gitmiş. SUPER_ADMIN ile tekrarlanabilir.
--
-- KÖK NEDEN: clubs UPDATE tek ayırt edici koşulu is_super_admin()'dir
-- (JoinButton/RSVPButton gibi auth.uid()=user_id ile anahtarlanan yazmalar
-- çalışıyor → auth.uid() istemci istek bağlamında DOLU). Danışman yazması
-- yalnızca is_super_admin()'e bağlı; bu fonksiyon istek bağlamında false
-- dönerse RLS USING satırı DIŞLAR → 0 satır güncellenir → PostgREST HATA
-- DÖNMEZ (error=null) → UI yanlışlıkla "kaydedildi" sanır. Ayrıca
-- prevent_advisor_change trigger'ı da `auth.uid() is not null` kapısıyla
-- 0-satır durumunda hiç ateşlenmez, yani hata da üretmez.
--
-- Bu migration canlı DB'deki is_super_admin() ve clubs_update_admin
-- tanımlarını KANONİK (profiles tabanlı) hallerine geri getirir — böylece
-- profiles.role='SUPER_ADMIN' olan hesap için fonksiyon KESİN true döner,
-- RLS USING/WITH CHECK ve trigger geçer, yazma kalıcı olur ve satır geri
-- okunabilir. İdempotent (create or replace + drop/create policy); tanımlar
-- zaten doğruysa no-op'tur, drift varsa onarır.
--
-- NOT: profiles.role production'da ENUM (user_role) — metin karşılaştırması
-- için role::text kullanılır (enum'da btrim/upper doğrudan çalışmaz).

-- ----------------------------------------------------------------------------
-- is_super_admin() — profiles'tan (RLS'siz, SECURITY DEFINER) oku. JWT'den
-- DEĞİL: rol claim'i token'da taşınmaz; tek doğruluk kaynağı profiles.role.
-- ----------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and upper(btrim(role::text)) = 'SUPER_ADMIN'
  );
$$;

-- RLS politikalarında kullanılabilmesi için execute yetkisi (idempotent).
grant execute on function public.is_super_admin() to authenticated, anon;

-- ----------------------------------------------------------------------------
-- clubs UPDATE — SUPER_ADMIN veya kulübün danışmanı veya başkanı.
-- (advisor_id/requires_advisor_approval değişimi ayrıca prevent_advisor_change
--  trigger'ı ile yalnız SUPER_ADMIN'e kilitli — o trigger'a DOKUNULMAZ.)
-- Kanonik tanımı yeniden yaz (20260616121000 ile aynı) — olası drift'i onar.
-- ----------------------------------------------------------------------------
drop policy if exists "clubs_update_admin" on public.clubs;
create policy "clubs_update_admin" on public.clubs
  for update
  using (public.is_super_admin() or public.is_club_advisor(id) or public.is_club_admin(id))
  with check (public.is_super_admin() or public.is_club_advisor(id) or public.is_club_admin(id));
