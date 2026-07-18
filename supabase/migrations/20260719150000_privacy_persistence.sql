-- 20260719150000_privacy_persistence
-- DÜZELTME TURU 1 / Commit 5 — Ürün kararları (denetim A bölümü).
--   5.1 Birden fazla başkan: KALSIN (yalnız belgeleme).
--   5.2 Kullanıcı silinince mesajlar: CASCADE → SET NULL (mesaj kalır, gönderen "silinmiş").
--   5.3 Hayalet rozetler: KALSIN (yalnız belgeleme).
--   5.4 Profil gizleme (opt-out): hide_profile + get_profile/search_public_profiles saygısı.
--   5.5 Kendi katılımına bildirim: KALDIRILSIN (on_member_joined self-bildirimi).
-- İdempotent: alter ... if exists / add column if not exists / create or replace / drop if exists.

-- ============================================================================
-- 5.2 — messages.sender_user_id: ON DELETE CASCADE → SET NULL, kolon nullable.
--   Gerekçe: kullanıcı silinince mesajları uçuyordu; karşı tarafın konuşması
--   yarım kalıyordu. Artık mesaj KALIR, gönderen NULL olur ("silinmiş kullanıcı").
--   DEFAULT auth.uid() korunur (insert'te sender dolu gelir; NULL yalnız silme sonrası).
-- ============================================================================
alter table public.messages alter column sender_user_id drop not null;

alter table public.messages drop constraint if exists messages_sender_user_id_fkey;
alter table public.messages
  add constraint messages_sender_user_id_fkey
  foreign key (sender_user_id) references public.profiles(id) on delete set null;

-- ============================================================================
-- 5.4 — Profil gizleme (opt-out). hide_profile + yazma grant'ı.
--   Broad SELECT'e AÇILMAZ (kolon-grant hâlâ id/full_name/role); değer get_profile
--   RPC'siyle (can_edit için) döner. UPDATE grant'ı kümülatif (idempotent).
-- ============================================================================
alter table public.profiles
  add column if not exists hide_profile boolean not null default false;

grant update (full_name, email, bio, department, class_year, avatar_url, hide_profile)
  on public.profiles to authenticated;

-- get_profile — hide_profile'a saygı. Zengin METİN alanları (bio/department/
-- class_year) yalnız: kişinin kendisi VEYA okul VEYA (kamusal VE gizlenmemiş).
-- Avatar (ad+rol+avatar temel kimliktir) kamusal kişide gizleme olsa da görünür.
-- Dönüşe 'hide_profile' eklenir (self toggle başlangıç değeri için).
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
  v_is_public boolean;
  v_see_rich boolean;
  v_see_avatar boolean;
  v_clubs json;
begin
  select id, full_name, role::text, bio, department, class_year, avatar_url,
         coalesce(hide_profile, false)
    into v_id, v_full_name, v_role, v_bio, v_department, v_class_year, v_avatar_url, v_hide
    from public.profiles
    where id = p_uid;

  if v_id is null then
    return null;
  end if;

  v_is_public := public.is_public_profile(p_uid);
  -- Zengin metin: kamusal VE gizlenmemiş, ya da self/super.
  v_see_rich := (p_uid = auth.uid())
    or public.is_super_admin()
    or (v_is_public and not v_hide);
  -- Avatar: self/super, ya da kamusal kişi (gizleme avatarı KAPATMAZ).
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
    'bio',        case when v_see_rich then v_bio        else null end,
    'department', case when v_see_rich then v_department else null end,
    'class_year', case when v_see_rich then v_class_year else null end,
    'avatar_url', case when v_see_avatar then v_avatar_url else null end,
    'clubs', v_clubs
  );
end;
$$;

grant execute on function public.get_profile(uuid) to authenticated;

-- search_public_profiles — gizli profilleri (hide_profile=true) sonuçlardan çıkar.
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
    and not coalesce(p.hide_profile, false)
    and p.full_name ilike '%' || btrim(p_query) || '%'
  order by p.full_name
  limit 20;
$$;

grant execute on function public.search_public_profiles(text) to authenticated;

-- ============================================================================
-- 5.5 — Kendi katılımına bildirim kaldır. on_member_joined YALNIZCA katılan
--   kişinin KENDİSİNE "hoş geldin" MEMBERSHIP bildirimi üretiyordu (kendi eylemi
--   → gürültü). Diğer üreticilerdeki "gönderene düşmez" prensibiyle tutarlı olması
--   için trigger + fonksiyon kaldırılır. (Rozet trigger'ı on_member_badges AYRI —
--   dokunulmaz.) MEMBERSHIP tipi CHECK'te kalır (zararsız; başka üretici yok).
-- ============================================================================
drop trigger if exists club_members_notify_join on public.club_members;
drop function if exists public.on_member_joined();

-- ============================================================================
-- 5.1 + 5.3 — Belgeleme (kod/DDL değişikliği yok; kararların KASITLI olduğunu işaretle).
-- ============================================================================
comment on function public.list_my_conversations() is
  'Kasıtlı tasarım (Düzeltme Turu 1, karar 5.1): bir kulübün BİRDEN FAZLA başkanı '
  '(club_members.role=ADMIN) olabilir; counterpart_label string_agg ile hepsini tek '
  'etikette birleştirir ve kanal anahtarı club_id olduğundan hepsi aynı thread''e düşer.';

comment on function public.grant_badge(uuid, text) is
  'Kasıtlı tasarım (Düzeltme Turu 1, karar 5.3): rozetler geri ALINMAZ. Kriter '
  'sonradan kalksa da (check-in iptali, üye ayrılması, başkanlık düşmesi) rozet kalır; '
  'rozet bir anıdır.';
