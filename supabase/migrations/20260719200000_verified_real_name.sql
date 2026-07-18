-- 20260719200000_verified_real_name
-- ÖZELLİK — E-postadan doğrulanmış gerçek ad + aramada ayırt edicilik.
--
-- PARÇA 1 (sunucu): Kayıt/güncellemede full_name e-posta yerelinden (ad.soyad####)
--   türetilenle eşleşmeye zorlanır — "Test Hocam" gibi sahte adlar elenir. İstemci
--   doğrulaması güvenlik değildir; bu SQL katmanı esastır. Aynı normalize mantığı
--   src/lib/name-from-email.ts'te tekrarlanır (Türkçe karakter → ASCII, I/ı tuzağı yok).
--   KAPSAM: yalnız YENİ kayıtlar (name_verified=true). Mevcut kullanıcılar name_verified
--   =false kalır (default) → adları ne doğrulanır ne de düzenlenmesi engellenir.
--
-- PARÇA 2 (arama): search_public_profiles class_year de döndürür (ayırt edici "bölüm ·
--   sınıf" satırı). E-posta/e-posta yereli DÖNMEZ (gizlilik korunur).
--
-- İdempotent: create or replace / add column if not exists / drop ... if exists.

-- ============================================================================
-- 1) Normalize + türetme + eşleşme yardımcıları (immutable; src/lib ile aynı mantık).
--    translate: Türkçe/aksanlı harfler toLowerCase'den ÖNCE ASCII'ye (İ ve ı → i).
-- ============================================================================
create or replace function public.normalize_name_token(p text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(
    lower(translate(coalesce(p, ''),
      'ğĞüÜşŞıİöÖçÇâÂîÎûÛ',
      'gguussiiooccaaiiuu')),
    '[^a-z]', '', 'g');
$$;

-- E-posta yereli (sondaki rakamlar atılmış) → normalize token.
create or replace function public.email_name_token(p_email text)
returns text language sql immutable set search_path = '' as $$
  select public.normalize_name_token(
    regexp_replace(split_part(coalesce(p_email, ''), '@', 1), '[0-9]+$', ''));
$$;

-- Yerel kısımda (rakamsız) nokta var mı → ad.soyad, yani doğrulanabilir.
create or replace function public.email_name_derivable(p_email text)
returns boolean language sql immutable set search_path = '' as $$
  select position('.' in regexp_replace(split_part(coalesce(p_email, ''), '@', 1), '[0-9]+$', '')) > 0
     and public.email_name_token(p_email) <> '';
$$;

-- Girilen ad e-posta yereliyle eşleşiyor mu (Türkçe düzeltmeye izinli).
create or replace function public.name_matches_email(p_name text, p_email text)
returns boolean language sql immutable set search_path = '' as $$
  select public.email_name_token(p_email) <> ''
     and public.normalize_name_token(p_name) = public.email_name_token(p_email);
$$;

-- ============================================================================
-- 2) profiles.name_verified — istemciden YAZILAMAZ (UPDATE kolon-grant'ında YOK,
--    20260713190000 + sonrası). Yalnız handle_new_user (definer) set eder.
-- ============================================================================
alter table public.profiles
  add column if not exists name_verified boolean not null default false;

-- ============================================================================
-- 3) handle_new_user — kayıt anında ad doğrulaması (yalnız derivable e-postada).
--    Derivable + eşleşmiyorsa kayıt REDDEDİLİR (auth.users insert rollback → signUp
--    hatası). Eşleşirse name_verified=true. Format dışı e-posta (nokta yok / metu
--    dışı) → serbest, name_verified=false (kilitlenme yok).
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_name text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  v_verified boolean := false;
begin
  if v_name is not null and public.email_name_derivable(new.email) then
    if not public.name_matches_email(v_name, new.email) then
      raise exception 'Adınız e-posta adresinizle eşleşmeli.';
    end if;
    v_verified := true;
  end if;

  insert into public.profiles (id, email, full_name, name_verified)
  values (new.id, new.email, v_name, v_verified)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ============================================================================
-- 4) enforce_verified_name — profil güncellemede (doğrudan update) doğrulama.
--    YALNIZ name_verified=true satırlarda ve full_name DEĞİŞİRKEN uygulanır → eski
--    kullanıcılar (false) etkilenmez. Doğrulama auth.users.email (değiştirilemez)
--    üzerinden — profiles.email istemciden güncellenebildiği için ona güvenilmez.
-- ============================================================================
create or replace function public.enforce_verified_name()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_auth_email text;
begin
  if new.name_verified and (new.full_name is distinct from old.full_name) then
    select email into v_auth_email from auth.users where id = new.id;
    if not public.name_matches_email(new.full_name, v_auth_email) then
      raise exception 'Adınız e-posta adresinizle eşleşmeli.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_verified_name on public.profiles;
create trigger enforce_verified_name
  before update on public.profiles
  for each row execute function public.enforce_verified_name();

-- ============================================================================
-- 5) get_profile — dönüşe name_verified eklenir (self için: profil formu doğrulama
--    uygulasın mı?). Gövde 20260719150000 (gizleme) haliyle aynı; yalnız yeni alan.
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
  v_hide boolean;
  v_name_verified boolean;
  v_is_public boolean;
  v_see_rich boolean;
  v_see_avatar boolean;
  v_clubs json;
begin
  select id, full_name, role::text, bio, department, class_year, avatar_url,
         coalesce(hide_profile, false), coalesce(name_verified, false)
    into v_id, v_full_name, v_role, v_bio, v_department, v_class_year, v_avatar_url,
         v_hide, v_name_verified
    from public.profiles
    where id = p_uid;

  if v_id is null then
    return null;
  end if;

  v_is_public := public.is_public_profile(p_uid);
  v_see_rich := (p_uid = auth.uid())
    or public.is_super_admin()
    or (v_is_public and not v_hide);
  v_see_avatar := (p_uid = auth.uid())
    or public.is_super_admin()
    or v_is_public;

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
    'hide_profile', v_hide,
    'name_verified', v_name_verified,
    'bio',        case when v_see_rich then v_bio        else null end,
    'department', case when v_see_rich then v_department else null end,
    'class_year', case when v_see_rich then v_class_year else null end,
    'avatar_url', case when v_see_avatar then v_avatar_url else null end,
    'clubs', v_clubs
  );
end;
$$;

grant execute on function public.get_profile(uuid) to authenticated;

-- ============================================================================
-- 6) search_public_profiles — class_year de döndürür (ayırt edici "bölüm · sınıf").
--    İmza değişimi → drop+create. hide_profile filtresi (20260719150000) KORUNUR.
--    E-posta / e-posta yereli DÖNMEZ (gizlilik).
-- ============================================================================
drop function if exists public.search_public_profiles(text);
create function public.search_public_profiles(p_query text)
returns table (
  id uuid,
  full_name text,
  role text,
  department text,
  class_year text
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.full_name, p.role::text, p.department, p.class_year
  from public.profiles p
  where char_length(btrim(coalesce(p_query, ''))) >= 2
    and public.is_public_profile(p.id)
    and not coalesce(p.hide_profile, false)
    and p.full_name ilike '%' || btrim(p_query) || '%'
  order by p.full_name
  limit 20;
$$;

grant execute on function public.search_public_profiles(text) to authenticated;
