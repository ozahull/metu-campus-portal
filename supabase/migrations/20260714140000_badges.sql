-- 20260714140000_badges
-- Faz 8B — Katılım rozetleri. Sıralama tablosu / puan YOK; hafif aidiyet.
-- "Gerçek katılım" = bilet check-in'i (tickets.status='CHECKED_IN'). Not:
-- event_attendees'te checked_in kolonu yok; sistemdeki tek gerçek "geldi"
-- sinyali bilet kapı girişidir, bu yüzden katılım rozetleri ondan sayılır.
-- KURAL: user_badges'e yazma yalnız SECURITY DEFINER; istemciden upsert YASAK.

-- ============================================================================
-- 1) Katalog + kullanıcı rozetleri
-- ============================================================================
create table if not exists public.badges (
  code text primary key,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.badges (code, sort_order) values
  ('FIRST_EVENT', 1),
  ('FIVE_EVENTS', 2),
  ('TEN_EVENTS', 3),
  ('FOUNDING_MEMBER', 4),
  ('CLUB_LEADER', 5)
on conflict (code) do nothing;

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_code text not null references public.badges(code) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_code)
);

create index if not exists user_badges_user_idx on public.user_badges (user_id);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

-- Rozetler herkese görünür (üye listesi/profil vitrini). Yazma yalnız RPC.
revoke all on public.badges from authenticated;
revoke all on public.badges from anon;
grant select on public.badges to authenticated;
revoke all on public.user_badges from authenticated;
revoke all on public.user_badges from anon;
grant select on public.user_badges to authenticated;

drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges
  for select to authenticated using (true);

drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges
  for select to authenticated using (true);

-- ============================================================================
-- 2) BADGE_EARNED bildirim tipi
-- ============================================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'EVENT_APPROVED','EVENT_NEW','EVENT_REMINDER','CLUB_ANNOUNCEMENT',
    'MEMBERSHIP','EVENT_PHOTOS','BADGE_EARNED'
  ));

-- ============================================================================
-- 3) Rozet verme (yeni kazanılırsa bildirim)
-- ============================================================================
create or replace function public.grant_badge(p_user uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  insert into public.user_badges (user_id, badge_code)
  values (p_user, p_code)
  on conflict (user_id, badge_code) do nothing;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    -- Yeni kazanıldı → kişisel bildirim (title = rozet kodu; UI çevirir).
    perform public.push_notification(
      p_user, 'BADGE_EARNED', p_code, null, '/profile', null, null
    );
  end if;
end;
$$;

-- Katılım rozetleri: check-in'li (CHECKED_IN) farklı etkinlik sayısına göre.
create or replace function public.award_attendance_badges(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c integer;
begin
  select count(distinct event_id) into v_c
  from public.tickets
  where user_id = p_user and status = 'CHECKED_IN';

  if v_c >= 1 then perform public.grant_badge(p_user, 'FIRST_EVENT'); end if;
  if v_c >= 5 then perform public.grant_badge(p_user, 'FIVE_EVENTS'); end if;
  if v_c >= 10 then perform public.grant_badge(p_user, 'TEN_EVENTS'); end if;
end;
$$;

-- ============================================================================
-- 4) Trigger'lar
-- ============================================================================
-- Bilet check-in olunca katılım rozetlerini yeniden değerlendir.
create or replace function public.on_ticket_checked_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_attendance_badges(new.user_id);
  return new;
end;
$$;

drop trigger if exists tickets_award_badges on public.tickets;
create trigger tickets_award_badges
  after update on public.tickets
  for each row
  when (new.status = 'CHECKED_IN' and old.status is distinct from 'CHECKED_IN')
  execute function public.on_ticket_checked_in();

-- Üyelik: kulübün ilk 10 üyesi → FOUNDING_MEMBER; başkan (ADMIN) → CLUB_LEADER.
create or replace function public.on_member_badges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rank integer;
begin
  select count(*) into v_rank
  from public.club_members m
  where m.club_id = new.club_id
    and (
      m.created_at < new.created_at
      or (m.created_at = new.created_at and m.user_id <= new.user_id)
    );
  if v_rank <= 10 then
    perform public.grant_badge(new.user_id, 'FOUNDING_MEMBER');
  end if;

  if upper(new.role) = 'ADMIN' then
    perform public.grant_badge(new.user_id, 'CLUB_LEADER');
  end if;

  return new;
end;
$$;

drop trigger if exists club_members_award_badges on public.club_members;
create trigger club_members_award_badges
  after insert or update on public.club_members
  for each row
  execute function public.on_member_badges();

-- ============================================================================
-- 5) Backfill (bildirimsiz — geçmiş kazanımlar retroaktif bildirim üretmesin)
-- ============================================================================
insert into public.user_badges (user_id, badge_code)
select user_id, 'FIRST_EVENT' from public.tickets
where status = 'CHECKED_IN'
group by user_id having count(distinct event_id) >= 1
on conflict do nothing;

insert into public.user_badges (user_id, badge_code)
select user_id, 'FIVE_EVENTS' from public.tickets
where status = 'CHECKED_IN'
group by user_id having count(distinct event_id) >= 5
on conflict do nothing;

insert into public.user_badges (user_id, badge_code)
select user_id, 'TEN_EVENTS' from public.tickets
where status = 'CHECKED_IN'
group by user_id having count(distinct event_id) >= 10
on conflict do nothing;

insert into public.user_badges (user_id, badge_code)
select user_id, 'FOUNDING_MEMBER'
from (
  select user_id,
         row_number() over (partition by club_id order by created_at, user_id) as rn
  from public.club_members
) ranked
where rn <= 10
on conflict do nothing;

insert into public.user_badges (user_id, badge_code)
select distinct user_id, 'CLUB_LEADER'
from public.club_members
where upper(role) = 'ADMIN'
on conflict do nothing;
