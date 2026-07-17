-- 20260717130000_person_profiles
-- Aşama 3 / Commit 3A — Kişi profilleri (adreslenebilir profil sistemi temeli).
--
-- BAĞLAM: Aşama 1'de bağımsız ADVISOR (Hoca) rolü + is_advisor(), Aşama 2'de
-- topluluk açma başvurusu geldi. Bu commit, kişileri ADRESLENEBİLİR yapar:
-- her kişinin id ile çekilebilen zengin bir profili (bio/bölüm/sınıf/avatar) ve
-- kamusal-rol kişiler için hafif bir arama yolu. UI (profil sayfası + arama +
-- avatar yükleme) 3B/3C'de gelecek — bu commit YALNIZCA DB katmanıdır.
--
-- GÜVENLİK/KVKK PRENSİBİ (email deseninin genişletilmesi):
--   profiles.email zaten broad SELECT'e KAPALI (20260615120700 — kolon-grant
--   yalnız id/full_name/role). AYNI prensiple zengin profil alanları
--   (bio/department/class_year/avatar_url) de broad SELECT'e AÇILMAZ: kolon-grant
--   SELECT listesine EKLENMEZ. Bu alanlar YALNIZCA SECURITY DEFINER get_profile
--   RPC'si üzerinden, ROL-KATMANLI görünürlükle sunulur. Böylece koruma
--   API-seviyesindedir (RLS satır filtresi + kolon grant + RPC kapısı) — istemci
--   profiles tablosundan bu alanları doğrudan SEÇEMEZ.
--
-- ROL-KATMANLI GÖRÜNÜRLÜK (get_profile):
--   * HER ZAMAN görünür (kimliksel/ilişkisel, PII değil): id, full_name, role,
--     kişinin kulüpleri (ilişki etiketiyle: advisor/president/member).
--   * KOŞULLU görünür (bio, department, class_year, avatar_url): yalnızca kişi
--     KAMUSAL bir role sahipse (is_public_profile) VEYA profili isteyen kişinin
--     KENDİSİYSE. Değilse bu 4 alan null döner (sızmaz). email HİÇBİR koşulda
--     dönmez.
--   KAMUSAL ROL TANIMI (is_public_profile): rolü ADVISOR/SUPER_ADMIN olan
--     kişiler + herhangi bir kulübün BAŞKANI (club_members.role='ADMIN'). Bu
--     kişiler kamusal görevleri gereği bulunabilir/görünür olmalıdır; sıradan
--     USER'ların zengin profili yalnızca kendilerine görünür (mahremiyet).
--
-- RLS-İÇİNDE-RLS TUZAĞINDAN KAÇINMA (Aşama 2 belge bug'ı — 20260717120000):
--   Kısıtlı okunan bir tabloya (profiles kolon-grant'lı; club_members) GÖMÜLÜ
--   alt-sorgu ile bakan RLS/policy'ler, gömülü değerlendirmede o tablonun kendi
--   RLS/grant'ına takılıp sessizce FALSE dönebilir. Bu yüzden TÜM cross-table
--   kontroller (is_public_profile) ve tüm zengin-alan okuması SECURITY DEFINER
--   fonksiyona taşınır; fonksiyon sahibi (definer) yetkisiyle tabloları RLS/grant
--   filtresi OLMADAN okur. is_super_admin/is_advisor/is_club_admin deseniyle
--   birebir aynı; search_path='' ile şema-enjeksiyonuna kapalı (tam nitelenmiş).
--
-- İdempotent: add column if not exists / create or replace / drop policy if exists.

-- ============================================================================
-- 1) ŞEMA — profiles'a zengin profil kolonları (hepsi nullable).
--    avatar_url = Storage PATH ('avatars' bucket), public URL DEĞİL — UI signed
--    URL üretir (bucket PRIVATE). broad SELECT'e AÇILMAZ (aşağıdaki grant'a bak).
-- ============================================================================
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists class_year text;
alter table public.profiles add column if not exists avatar_url text;

-- ============================================================================
-- 2) GRANT'lar.
--    SELECT'e DOKUNULMAZ: authenticated hâlâ yalnız (id, full_name, role) SEÇER
--    (20260615120700). Zengin alanlar KASITLI olarak broad SELECT'e açılmaz;
--    yalnız get_profile RPC'si (rol-katmanlı) sunar.
--    UPDATE grant'ını yeni kolonlarla genişlet (kolon grant'ları kümülatiftir;
--    yeniden çalıştırma idempotent). Kullanıcı yalnız KENDİ satırını günceller —
--    profiles_update_self RLS (auth.uid()=id) zaten kısıtlar, DOKUNULMAZ.
--    role/id ve email-OKUMA yazma yolunda YOK (mevcut sıkılaştırma korunur:
--    role prevent_role_escalation + kolon-dışı; email yalnız yazılır, okunmaz).
-- ============================================================================
grant update (full_name, email, bio, department, class_year, avatar_url)
  on public.profiles to authenticated;

-- ============================================================================
-- 3) is_public_profile(p_uid) — kişi KAMUSAL bir role sahip mi?
--    is_advisor/is_super_admin deseniyle birebir (SECURITY DEFINER, search_path='',
--    stable, role::text ile enum-güvenli). KAMUSAL = ADVISOR/SUPER_ADMIN VEYA
--    herhangi bir kulübün başkanı (club_members.role='ADMIN'). Zengin-alan
--    görünürlüğünün ve avatar okumasının rol-katmanlı temeli budur.
-- ============================================================================
create or replace function public.is_public_profile(p_uid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    exists (
      select 1 from public.profiles
      where id = p_uid
        and upper(btrim(role::text)) in ('ADVISOR', 'SUPER_ADMIN')
    )
    or exists (
      select 1 from public.club_members
      where user_id = p_uid
        and upper(btrim(role::text)) = 'ADMIN'
    );
$$;

grant execute on function public.is_public_profile(uuid) to authenticated;

-- ============================================================================
-- 4) get_profile(p_uid) — adreslenebilir profil (rol-katmanlı, KVKK-güvenli).
--    SECURITY DEFINER: profiles/clubs/club_members'ı RLS/grant filtresiz okur
--    (RLS-içinde-RLS tuzağı yok). Dönüş: tek json nesnesi (kişi yoksa null).
--    email HİÇBİR koşulda dönmez.
--
--    Kulüp ilişkileri: her kulüp için TEK satır, öncelik advisor > president >
--    member (aynı kulüpte hem danışman hem üye ise 'advisor' kazanır). relation ∈
--    ('advisor'|'president'|'member'):
--      advisor   → clubs.advisor_id = p_uid
--      president → club_members.role = 'ADMIN'
--      member    → club_members.role = 'MEMBER'
--
--    Zengin alanlar (bio/department/class_year/avatar_url) yalnız
--    is_public_profile(p_uid) VEYA p_uid = auth.uid() ise dolu; aksi halde null.
--    can_edit: (p_uid = auth.uid()) — UI'daki "Düzenle" butonu için.
-- ============================================================================
create or replace function public.get_profile(p_uid uuid)
returns json
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_id uuid;
  v_full_name text;
  v_role text;
  v_bio text;
  v_department text;
  v_class_year text;
  v_avatar_url text;
  v_can_see boolean;
  v_clubs json;
begin
  select id, full_name, role::text, bio, department, class_year, avatar_url
    into v_id, v_full_name, v_role, v_bio, v_department, v_class_year, v_avatar_url
    from public.profiles
    where id = p_uid;

  -- Kişi yoksa null (sızıntı yok, UI 404 gösterir).
  if v_id is null then
    return null;
  end if;

  -- Rol-katmanlı görünürlük: zengin alanlar yalnız kamusal-rol kişiler için ya
  -- da kişinin KENDİSİ için görünür.
  v_can_see := public.is_public_profile(p_uid) or (p_uid = auth.uid());

  -- Kulüp ilişkileri — advisor(1) > president(2) > member(3) önceliğiyle tek
  -- satır/kulüp; sonuç kulüp adına göre sıralı.
  select coalesce(
    json_agg(
      json_build_object(
        'club_id', x.club_id,
        'club_name', x.club_name,
        'relation', x.relation
      )
      order by x.club_name
    ),
    '[]'::json
  )
  into v_clubs
  from (
    select distinct on (r.club_id) r.club_id, r.club_name, r.relation
    from (
      select c.id as club_id, c.name as club_name, 'advisor'::text as relation, 1 as pri
      from public.clubs c
      where c.advisor_id = p_uid
      union all
      select c.id, c.name,
             case when upper(btrim(cm.role::text)) = 'ADMIN'
                  then 'president'::text else 'member'::text end,
             case when upper(btrim(cm.role::text)) = 'ADMIN'
                  then 2 else 3 end
      from public.club_members cm
      join public.clubs c on c.id = cm.club_id
      where cm.user_id = p_uid
    ) r
    order by r.club_id, r.pri
  ) x;

  return json_build_object(
    'id', v_id,
    'full_name', v_full_name,
    'role', v_role,
    'can_edit', (p_uid = auth.uid()),
    'bio',        case when v_can_see then v_bio        else null end,
    'department', case when v_can_see then v_department else null end,
    'class_year', case when v_can_see then v_class_year else null end,
    'avatar_url', case when v_can_see then v_avatar_url else null end,
    'clubs', v_clubs
  );
end;
$$;

grant execute on function public.get_profile(uuid) to authenticated;

-- ============================================================================
-- 5) search_public_profiles(p_query) — hafif kamusal profil araması.
--    SECURITY DEFINER, stable. Yalnız KAMUSAL kişiler (is_public_profile) +
--    full_name ILIKE eşleşmesi. p_query 2 karakterden kısaysa BOŞ set (spam /
--    tam-tablo taramasını önle). limit 20, ada göre sıralı. email/bio/avatar
--    DÖNMEZ (arama hafif; ayrıntı get_profile'da). department listede yardımcı.
-- ============================================================================
create or replace function public.search_public_profiles(p_query text)
returns table (
  id uuid,
  full_name text,
  role text,
  department text
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.full_name, p.role::text, p.department
  from public.profiles p
  where char_length(btrim(coalesce(p_query, ''))) >= 2
    and public.is_public_profile(p.id)
    and p.full_name ilike '%' || btrim(p_query) || '%'
  order by p.full_name
  limit 20;
$$;

grant execute on function public.search_public_profiles(text) to authenticated;

-- ============================================================================
-- 6) STORAGE — 'avatars' bucket policy'leri.
--    ⚠️ BUCKET'ı Supabase panelinden PRIVATE olarak ELLE oluştur (event-docs /
--    club-request-docs gibi). Aşağıdaki RLS policy'leri storage.objects üzerinde
--    tanımlanır; erişim signed URL ile olur.
--    Path deseni: ${auth.uid()}/${timestamp}.${ext}  (herkes kendi klasöründe).
--
--    INSERT/UPDATE/DELETE: yalnız KENDİ klasörün (cross-table YOK → RLS-içinde-RLS
--    tuzağı yok). SELECT: kendi avatarın + KAMUSAL kişilerin avatarı (rol-katmanlı
--    görünürlükle tutarlı; is_public_profile SECURITY DEFINER olduğu için güvenli).
-- ============================================================================

-- INSERT: yalnız kendi klasörüne yaz.
drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: upsert (aynı yolu üzerine yazma) için — aynı klasör kısıtı.
drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: kendi avatarın + okul + kamusal-rol kişilerin avatarı (signed URL bunun
-- üzerinden). Klasör adı (uid) uuid'ye cast edilip is_public_profile'a verilir;
-- INSERT policy'si klasörü auth.uid()'e sabitlediğinden cast güvenlidir.
drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and (
    owner = auth.uid()
    or public.is_super_admin()
    or public.is_public_profile(((storage.foldername(name))[1])::uuid)
  )
);

-- DELETE: yalnız kendi avatarını sil.
drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
