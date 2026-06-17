-- 20260617150000_analytics
-- Faz 6: Okula raporlama — analitik okuma RPC'leri (yalnız SUPER_ADMIN)

-- 1) Kampüs geneli özet
drop function if exists public.analytics_overview();
create function public.analytics_overview()
returns table (
  total_clubs bigint,
  total_members bigint,
  total_events bigint,
  approved_events bigint,
  total_tickets bigint,
  total_checkins bigint
)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Yetkisiz'; end if;
  return query
  select
    (select count(*) from public.clubs),
    (select count(*) from public.club_members),
    (select count(*) from public.events),
    (select count(*) from public.events where status = 'APPROVED'),
    (select count(*) from public.tickets where status in ('APPROVED','CHECKED_IN')),
    (select count(*) from public.tickets where status = 'CHECKED_IN');
end; $$;

-- 2) Kulüp bazlı performans
drop function if exists public.analytics_clubs();
create function public.analytics_clubs()
returns table (
  club_id uuid,
  club_name text,
  member_count bigint,
  event_count bigint,
  approved_event_count bigint,
  total_checkins bigint
)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Yetkisiz'; end if;
  return query
  select
    c.id, c.name,
    (select count(*) from public.club_members m where m.club_id = c.id),
    (select count(*) from public.events e where e.club_id = c.id),
    (select count(*) from public.events e where e.club_id = c.id and e.status = 'APPROVED'),
    (select count(*) from public.tickets t
       join public.events e on e.id = t.event_id
      where e.club_id = c.id and t.status = 'CHECKED_IN')
  from public.clubs c
  order by c.name;
end; $$;

-- 3) Aylık üye artışı (zaman serisi)
drop function if exists public.analytics_member_growth();
create function public.analytics_member_growth()
returns table (
  month text,
  new_members bigint
)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Yetkisiz'; end if;
  return query
  select
    to_char(date_trunc('month', m.created_at), 'YYYY-MM'),
    count(*)
  from public.club_members m
  group by date_trunc('month', m.created_at)
  order by date_trunc('month', m.created_at);
end; $$;

grant execute on function public.analytics_overview()      to authenticated;
grant execute on function public.analytics_clubs()         to authenticated;
grant execute on function public.analytics_member_growth() to authenticated;
