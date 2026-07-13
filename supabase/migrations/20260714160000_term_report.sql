-- 20260714160000_term_report
-- Faz 9B — Okul yönetimi dönem raporu. Tarih aralığına göre kulüp bazlı
-- toplulaştırma (Faz 6 analitiğinin üstüne). Yalnız SUPER_ADMIN çağırabilir.

create or replace function public.analytics_term_report(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  club_id uuid,
  club_name text,
  member_total bigint,
  new_members bigint,
  event_count bigint,
  rsvp_total bigint,
  checkin_total bigint
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Yetkisiz';
  end if;

  return query
  select
    c.id,
    c.name,
    (select count(*) from public.club_members m where m.club_id = c.id),
    (select count(*) from public.club_members m
       where m.club_id = c.id
         and m.created_at >= p_start and m.created_at < p_end),
    (select count(*) from public.events e
       where e.club_id = c.id and e.status = 'APPROVED'
         and e.event_date >= p_start and e.event_date < p_end),
    (select count(*) from public.event_attendees a
       join public.events e on e.id = a.event_id
       where e.club_id = c.id and e.status = 'APPROVED'
         and e.event_date >= p_start and e.event_date < p_end),
    (select count(*) from public.tickets tk
       join public.events e on e.id = tk.event_id
       where e.club_id = c.id and tk.status = 'CHECKED_IN'
         and e.event_date >= p_start and e.event_date < p_end)
  from public.clubs c
  order by c.name;
end;
$$;

grant execute on function public.analytics_term_report(timestamptz, timestamptz)
  to authenticated;
