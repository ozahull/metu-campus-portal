-- Faz 0 / Adım 5 (RLS) — Tüm Row Level Security politikalarını sürüm kontrolüne
-- al. Hepsi idempotent (drop policy if exists + create). Öğrenci tarafı
-- davranışı korunur: events SELECT yine status='APPROVED' bazlıdır.

-- ----------------------------------------------------------------------------
-- Yardımcı: oturum açan kullanıcı SUPER_ADMIN mi? (RLS özyinelemesini önlemek
-- için SECURITY DEFINER; profiles'ı RLS'siz okur.)
-- NOT: production'da profiles.role bir ENUM (user_role) tipindedir; bu yüzden
-- metin işlemleri için role::text kullanılır (enum'da btrim/upper doğrudan çalışmaz).
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

-- ----------------------------------------------------------------------------
-- Güvenlik: kullanıcı kendi profilinde role'ü DEĞİŞTİREMEZ (ayrıcalık
-- yükseltme deliği). Yalnızca SUPER_ADMIN ya da sunucu (service_role,
-- auth.uid() null) role'ü değiştirebilir.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_super_admin() then
    raise exception 'Rol değiştirme yetkiniz yok.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_escalation on public.profiles;
create trigger prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ----------------------------------------------------------------------------
-- RLS'i etkinleştir (idempotent)
-- ----------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.clubs           enable row level security;
alter table public.club_members    enable row level security;
alter table public.events          enable row level security;
alter table public.event_attendees enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
--   SELECT: oturum açmış herkes (üye listelerinde isim gösterimi için).
--   INSERT/UPDATE: yalnızca kendi satırı (role değişimi trigger ile korunur).
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() is not null);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- clubs
--   SELECT: herkes. INSERT/UPDATE/DELETE: yalnızca SUPER_ADMIN
--   (advisor_id değişikliği de bu UPDATE politikasıyla sınırlanır).
-- ----------------------------------------------------------------------------
drop policy if exists "clubs_select" on public.clubs;
create policy "clubs_select" on public.clubs
  for select using (true);

drop policy if exists "clubs_insert_admin" on public.clubs;
create policy "clubs_insert_admin" on public.clubs
  for insert with check (public.is_super_admin());

drop policy if exists "clubs_update_admin" on public.clubs;
create policy "clubs_update_admin" on public.clubs
  for update using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "clubs_delete_admin" on public.clubs;
create policy "clubs_delete_admin" on public.clubs
  for delete using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- club_members
--   SELECT: herkes. INSERT: kendisi ve YALNIZCA role='MEMBER' (escalation
--   koruması). DELETE: kendisi. UPDATE (örn. 'ADMIN' atama): SUPER_ADMIN.
-- ----------------------------------------------------------------------------
drop policy if exists "club_members_select" on public.club_members;
create policy "club_members_select" on public.club_members
  for select using (true);

drop policy if exists "club_members_insert_self_member" on public.club_members;
create policy "club_members_insert_self_member" on public.club_members
  for insert with check (auth.uid() = user_id and role = 'MEMBER');

drop policy if exists "club_members_delete_self" on public.club_members;
create policy "club_members_delete_self" on public.club_members
  for delete using (auth.uid() = user_id);

drop policy if exists "club_members_update_admin" on public.club_members;
create policy "club_members_update_admin" on public.club_members
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- events
--   SELECT: onaylı etkinlikleri herkes; SUPER_ADMIN tümünü (ileride PENDING).
--   INSERT/UPDATE/DELETE: SUPER_ADMIN.
-- ----------------------------------------------------------------------------
drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events
  for select using (status = 'APPROVED' or public.is_super_admin());

drop policy if exists "events_insert_admin" on public.events;
create policy "events_insert_admin" on public.events
  for insert with check (public.is_super_admin());

drop policy if exists "events_update_admin" on public.events;
create policy "events_update_admin" on public.events
  for update using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "events_delete_admin" on public.events;
create policy "events_delete_admin" on public.events
  for delete using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- event_attendees
--   SELECT: herkes. INSERT/DELETE: kendisi.
-- ----------------------------------------------------------------------------
drop policy if exists "event_attendees_select" on public.event_attendees;
create policy "event_attendees_select" on public.event_attendees
  for select using (true);

drop policy if exists "event_attendees_insert_self" on public.event_attendees;
create policy "event_attendees_insert_self" on public.event_attendees
  for insert with check (auth.uid() = user_id);

drop policy if exists "event_attendees_delete_self" on public.event_attendees;
create policy "event_attendees_delete_self" on public.event_attendees
  for delete using (auth.uid() = user_id);
