-- 20260715130000_ticket_issue
-- Ödeme katmanı kaldırılıyor — ücretsiz "katılım bileti" akışı.
-- Bilet artık ödeme/dekont beklemeden DOĞRUDAN 'APPROVED' doğar; öğrenci
-- anında QR + token alır, kapıda ticket_checkin ile CHECKED_IN olur (rozet
-- trigger'ı değişmeden çalışır). Bu migration yalnızca ÜRETİM (issue) RPC'sini
-- ekler; ödeme kolon/durum/RPC temizliği ayrı migration'da (remove_payment_layer).
--
-- KAPASİTE + SON TARİH kontrolü eski ticket_approve'dan buraya (üretim anına)
-- taşındı (Karar 1: ticket_capacity + ticket_deadline korunuyor).
-- OPT-IN (Karar 2): yalnızca clubs.ticket_enabled açık etkinlikte bilet verilir.
-- İDEMPOTENT: aynı kullanıcı+etkinlik ikinci kez çağırırsa yeni bilet açmaz
-- (mevcut bileti korur; unique(event_id,user_id) + erken return + ON CONFLICT).

create or replace function public.ticket_issue(p_event uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_enabled boolean;
  v_capacity integer;
  v_deadline timestamptz;
  v_event_date timestamptz;
  v_status text;
  v_count integer;
  v_existing uuid;
begin
  -- Etkinlik yalnızca APPROVED (öğrenciye görünür) ve bilet açık kulüpten olmalı.
  select e.club_id, c.ticket_enabled, e.ticket_capacity, e.ticket_deadline,
         e.event_date, e.status
    into v_club_id, v_enabled, v_capacity, v_deadline, v_event_date, v_status
  from public.events e
  join public.clubs c on c.id = e.club_id
  where e.id = p_event;

  if v_club_id is null then
    raise exception 'Etkinlik bulunamadı';
  end if;
  if v_status <> 'APPROVED' then
    raise exception 'Etkinlik yayında değil';
  end if;
  if not coalesce(v_enabled, false) then
    raise exception 'Bu etkinlikte katılım bileti kapalı';
  end if;

  -- İdempotent: mevcut bilet varsa hiçbir şey yapma (çift bilet yok).
  select id into v_existing
  from public.tickets
  where event_id = p_event and user_id = auth.uid();
  if v_existing is not null then
    return;
  end if;

  -- Son tarih: ticket_deadline ya da (tanımsızsa) etkinlik saati.
  if coalesce(v_deadline, v_event_date) <= now() then
    raise exception 'Bilet alımı kapandı';
  end if;

  -- Kapasite: geçerli (APPROVED + CHECKED_IN) bilet sayısı.
  if v_capacity is not null then
    select count(*) into v_count
    from public.tickets
    where event_id = p_event and status in ('APPROVED', 'CHECKED_IN');
    if v_count >= v_capacity then
      raise exception 'Kapasite dolu';
    end if;
  end if;

  insert into public.tickets (event_id, user_id, status)
  values (p_event, auth.uid(), 'APPROVED')
  on conflict (event_id, user_id) do nothing;
end;
$$;

grant execute on function public.ticket_issue(uuid) to authenticated;
