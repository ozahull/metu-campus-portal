-- Faz 1 / A1 + A3 — CLUB_ADMIN yetkisi: yardımcı fonksiyon + RLS genişletme.
-- Kulüp başkanı (club_members.role='ADMIN') YALNIZCA kendi kulübünü yönetebilir.
-- GÜVENLİK: bu politikalar yalnızca per-club club_members.role'ü etkiler.
-- Global profiles.role hâlâ prevent_role_escalation trigger'ıyla korunur (dokunulmadı).

-- ----------------------------------------------------------------------------
-- Yardımcı: kullanıcı verilen kulübün ADMIN'i mi?
-- ----------------------------------------------------------------------------
create or replace function public.is_club_admin(p_club_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id
      and user_id = auth.uid()
      and upper(btrim(role::text)) = 'ADMIN'
  );
$$;

-- ----------------------------------------------------------------------------
-- clubs UPDATE: SUPER_ADMIN veya kulübün ADMIN'i
-- ----------------------------------------------------------------------------
drop policy if exists "clubs_update_admin" on public.clubs;
create policy "clubs_update_admin" on public.clubs
  for update
  using (public.is_super_admin() or public.is_club_admin(id))
  with check (public.is_super_admin() or public.is_club_admin(id));

-- ----------------------------------------------------------------------------
-- events INSERT/UPDATE/DELETE: SUPER_ADMIN veya kulübün ADMIN'i
-- ----------------------------------------------------------------------------
drop policy if exists "events_insert_admin" on public.events;
create policy "events_insert_admin" on public.events
  for insert
  with check (public.is_super_admin() or public.is_club_admin(club_id));

drop policy if exists "events_update_admin" on public.events;
create policy "events_update_admin" on public.events
  for update
  using (public.is_super_admin() or public.is_club_admin(club_id))
  with check (public.is_super_admin() or public.is_club_admin(club_id));

drop policy if exists "events_delete_admin" on public.events;
create policy "events_delete_admin" on public.events
  for delete
  using (public.is_super_admin() or public.is_club_admin(club_id));

-- ----------------------------------------------------------------------------
-- club_members yönetimi: SUPER_ADMIN veya kulübün ADMIN'i kendi kulübünün
-- üyelerini ekleyebilir/güncelleyebilir/silebilir.
-- (Self-join politikası "club_members_insert_self_member" korunur; normal
--  kullanıcı yalnızca kendini ve role='MEMBER' olarak ekleyebilir.)
-- ----------------------------------------------------------------------------
drop policy if exists "club_members_insert_manage" on public.club_members;
create policy "club_members_insert_manage" on public.club_members
  for insert
  with check (public.is_super_admin() or public.is_club_admin(club_id));

-- Eski yalnızca-SUPER_ADMIN UPDATE politikasını yönetim politikasıyla değiştir.
drop policy if exists "club_members_update_admin" on public.club_members;
drop policy if exists "club_members_update_manage" on public.club_members;
create policy "club_members_update_manage" on public.club_members
  for update
  using (public.is_super_admin() or public.is_club_admin(club_id))
  with check (public.is_super_admin() or public.is_club_admin(club_id));

-- Self-delete'e ek olarak yöneticiler de üye çıkarabilir.
drop policy if exists "club_members_delete_manage" on public.club_members;
create policy "club_members_delete_manage" on public.club_members
  for delete
  using (public.is_super_admin() or public.is_club_admin(club_id));
