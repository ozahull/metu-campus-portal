-- 20260716120000_advisor_role
-- HOCA (ADVISOR) rolü altyapısı — büyük özellik dizisinin (topluluk açma
-- başvurusu + hoca rolü + kişi profilleri + mesajlaşma) İLK temel adımı.
--
-- BAĞLAM: Şu ana dek profiles.role yalnızca 'USER' | 'SUPER_ADMIN' idi.
-- "Danışman" ayrı bir rol DEĞİLDİ — sadece clubs.advisor_id bir kullanıcıya
-- işaret ediyordu (tavuk-yumurta: kulüp açmak için hoca olmalı, hoca olmak için
-- kulübe atanmalı). Bu migration HOCA'yı BAĞIMSIZ bir global rol yapar; böylece
-- bir kişi henüz hiçbir kulübe bağlı değilken de hoca olabilir (başvuru akışı
-- Aşama 2'de gelecek — burada YALNIZCA rol altyapısı + atama yolu).
--
-- İdempotent: drop-if-exists + create-or-replace desenleri; yeniden çalıştırma
-- güvenli, drift'i onarır. clubs.advisor_id ve is_club_advisor() DOKUNULMAZ —
-- bunlar "bir kulübün akademik danışmanı" kavramıdır ve yeni ADVISOR rolünden
-- BAĞIMSIZDIR (biri profiles.role, diğeri clubs.advisor_id).

-- ----------------------------------------------------------------------------
-- 1) profiles.role CHECK'ini genişlet: üçüncü değer 'ADVISOR'.
--    Canlı DB'de (temiz migration derlemesi — base_schema.sql) role bir TEXT
--    kolonudur; CHECK ile kısıtlanır. role::text kullanımı, kolon olası bir
--    legacy user_role ENUM'u olsa bile CHECK ifadesinin OLUŞTURULABİLİR
--    kalmasını sağlar (metne cast; 'ADVISOR' asla enum'a cast edilmez) ve
--    reponun her yerdeki role::text konvansiyonuyla tutarlıdır.
--    Mevcut satırlar yalnız 'USER'/'SUPER_ADMIN' olduğundan kısıt geçmişi kırmaz.
-- ----------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role::text in ('USER', 'ADVISOR', 'SUPER_ADMIN'));

-- ----------------------------------------------------------------------------
-- 2) is_advisor() — oturum açan kullanıcının rolü ADVISOR mı? is_super_admin()
--    desenini birebir taklit eder (SECURITY DEFINER, search_path='', stable,
--    role::text ile enum-güvenli). SADECE ADVISOR döner; SUPER_ADMIN'i
--    KAPSAMAZ — yetki gerektiğinde çağıran taraf `is_advisor() OR
--    is_super_admin()` biçiminde birleştirir (Aşama 2).
-- ----------------------------------------------------------------------------
create or replace function public.is_advisor()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and upper(btrim(role::text)) = 'ADVISOR'
  );
$$;

grant execute on function public.is_advisor() to authenticated, anon;

-- ----------------------------------------------------------------------------
-- 3) Rol atama yolu — set_user_role(p_user_id, p_role).
--
--    NEDEN RPC? profiles'a İSTEMCİDEN role yazma yolu KAPALIDIR (tasarım):
--      * kolon-grant (20260713190000): authenticated yalnız (full_name,email)
--        UPDATE edebilir — 'role' HİÇBİR yazma grant'ında yok;
--      * RLS (profiles_update_self): yalnızca kendi satırını günceller —
--        SUPER_ADMIN'in BAŞKA kullanıcının rolünü değiştireceği politika yok;
--      * prevent_role_escalation trigger'ı: role değişimini SUPER_ADMIN dışına
--        kapatır.
--    Yani doğrudan `update profiles set role=...` istemciden İMKÂNSIZ. Bu
--    tasarımı (çift koruma) ZAYIFLATMADAN — yeni kolon-grant/RLS deliği açmadan
--    — atama, is_super_admin() kapılı bir SECURITY DEFINER RPC ile yapılır
--    (repodaki event_submit/ticket_approve/club_announce vb. ile aynı idiom).
--
--    GÜVENLİK KİLİTLERİ:
--      * Yalnız SUPER_ADMIN çağırabilir (aksi 'Yetkisiz').
--      * p_role beyaz listesi YALNIZCA {'USER','ADVISOR'} — bu RPC'den ASLA
--        SUPER_ADMIN atanamaz (ayrıcalık yükseltme deliği yok).
--      * Hedef zaten SUPER_ADMIN ise değiştirilemez (bu araçla süper yönetici
--        demote edilemez; kapsam dışı).
--    RPC owner (postgres) olarak çalıştığından RLS+kolon-grant'ı yasal olarak
--    aşar; prevent_role_escalation trigger'ı ateşlense de is_super_admin()=true
--    olduğundan geçer.
-- ----------------------------------------------------------------------------
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if not public.is_super_admin() then
    raise exception 'Yetkisiz';
  end if;

  if p_role not in ('USER', 'ADVISOR') then
    raise exception 'Geçersiz rol: %', p_role;
  end if;

  select upper(btrim(role::text)) into v_current
  from public.profiles
  where id = p_user_id;

  if v_current is null then
    raise exception 'Kullanıcı bulunamadı';
  end if;

  if v_current = 'SUPER_ADMIN' then
    raise exception 'Süper yönetici bu araçla değiştirilemez';
  end if;

  update public.profiles
    set role = p_role
    where id = p_user_id;

  return p_role;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) Rol atama güvenliği DOĞRULAMASI (yeni delik AÇILMADI):
--    prevent_role_escalation trigger'ı (20260615120600) role'ün HERHANGİ bir
--    değere değişimini `not is_super_admin()` ile bloklar — 'ADVISOR' dahil
--    (değer-agnostiktir). profiles UPDATE grant/RLS'i değişmedi. Böylece
--    ADVISOR ataması da mevcut kilitle YALNIZCA SUPER_ADMIN'e (set_user_role
--    RPC yolu üzerinden) açıktır. Bu blokta bilinçli olarak DDL yoktur.
-- ----------------------------------------------------------------------------
