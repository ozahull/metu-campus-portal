-- Faz 1.5 — Yetki devri: okul (SUPER_ADMIN) → danışman → başkan.
-- Model: Okul yalnızca DANIŞMAN atar. Danışman, kulübünün BAŞKANINI
-- (club_members.role='ADMIN') atar/geri alır ve kulübü yönetir. Başkan
-- kulübü/etkinlikleri/üyeleri yönetir AMA başkan atayamaz.

-- ----------------------------------------------------------------------------
-- 1) Yardımcı: kullanıcı verilen kulübün danışmanı mı?
-- ----------------------------------------------------------------------------
create or replace function public.is_club_advisor(p_club_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.clubs
    where id = p_club_id
      and advisor_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 2) Yönetim yetkisine danışmanı da ekle (SUPER_ADMIN OR danışman OR başkan).
--    advisor_id'yi yalnızca SUPER_ADMIN değiştirir kuralı (prevent_advisor_change
--    trigger) AYNEN kalır.
-- ----------------------------------------------------------------------------
drop policy if exists "clubs_update_admin" on public.clubs;
create policy "clubs_update_admin" on public.clubs
  for update
  using (public.is_super_admin() or public.is_club_advisor(id) or public.is_club_admin(id))
  with check (public.is_super_admin() or public.is_club_advisor(id) or public.is_club_admin(id));

drop policy if exists "events_insert_admin" on public.events;
create policy "events_insert_admin" on public.events
  for insert
  with check (public.is_super_admin() or public.is_club_advisor(club_id) or public.is_club_admin(club_id));

drop policy if exists "events_update_admin" on public.events;
create policy "events_update_admin" on public.events
  for update
  using (public.is_super_admin() or public.is_club_advisor(club_id) or public.is_club_admin(club_id))
  with check (public.is_super_admin() or public.is_club_advisor(club_id) or public.is_club_admin(club_id));

drop policy if exists "events_delete_admin" on public.events;
create policy "events_delete_admin" on public.events
  for delete
  using (public.is_super_admin() or public.is_club_advisor(club_id) or public.is_club_admin(club_id));

drop policy if exists "club_members_insert_manage" on public.club_members;
create policy "club_members_insert_manage" on public.club_members
  for insert
  with check (public.is_super_admin() or public.is_club_advisor(club_id) or public.is_club_admin(club_id));

drop policy if exists "club_members_update_manage" on public.club_members;
create policy "club_members_update_manage" on public.club_members
  for update
  using (public.is_super_admin() or public.is_club_advisor(club_id) or public.is_club_admin(club_id))
  with check (public.is_super_admin() or public.is_club_advisor(club_id) or public.is_club_admin(club_id));

drop policy if exists "club_members_delete_manage" on public.club_members;
create policy "club_members_delete_manage" on public.club_members
  for delete
  using (public.is_super_admin() or public.is_club_advisor(club_id) or public.is_club_admin(club_id));

-- ----------------------------------------------------------------------------
-- 3) GÜVENLİK — başkan (ADMIN) atamasını kilitle.
--    Bir club_members satırının role'ü 'ADMIN' olurken / 'ADMIN'likten çıkarken
--    ya da bir BAŞKAN satırı SİLİNİRKEN, bunu yalnızca SUPER_ADMIN veya kulübün
--    DANIŞMANI yapabilir. Başkan (is_club_admin) RLS gereği üye ekleyip
--    çıkarabilir ama bu trigger onu yalnızca role='MEMBER' işlemleriyle sınırlar.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_unauthorized_club_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_change boolean;
begin
  if tg_op = 'INSERT' then
    v_admin_change := upper(btrim(new.role::text)) = 'ADMIN';
  elsif tg_op = 'DELETE' then
    v_admin_change := upper(btrim(old.role::text)) = 'ADMIN';
  else
    v_admin_change := (new.role is distinct from old.role)
      and (
        upper(btrim(new.role::text)) = 'ADMIN'
        or upper(btrim(old.role::text)) = 'ADMIN'
      );
  end if;

  if v_admin_change
     and auth.uid() is not null
     and not (
       public.is_super_admin()
       or public.is_club_advisor(coalesce(new.club_id, old.club_id))
     ) then
    raise exception 'Başkan atamasını yalnızca danışman veya okul yapabilir.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_unauthorized_club_admin on public.club_members;
create trigger prevent_unauthorized_club_admin
  before insert or update or delete on public.club_members
  for each row execute function public.prevent_unauthorized_club_admin();
