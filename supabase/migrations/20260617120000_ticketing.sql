-- 20260617120000_ticketing
-- Faz 4: Biletleme (IBAN + dekont + QR check-in). Online ödeme yok.

create extension if not exists pgcrypto;

-- 1) clubs: IBAN + bilet anahtarı -----------------------------------------
alter table public.clubs add column if not exists iban text;
alter table public.clubs add column if not exists ticket_enabled boolean not null default false;

-- 2) events: bilet alanları -----------------------------------------------
alter table public.events add column if not exists ticket_price numeric(10,2);   -- null = ücretsiz
alter table public.events add column if not exists ticket_capacity integer;        -- null = sınırsız
alter table public.events add column if not exists ticket_deadline timestamptz;    -- null = etkinlik saatine kadar

-- 3) tickets tablosu ------------------------------------------------------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique default upper(encode(gen_random_bytes(5), 'hex')), -- QR içeriği, okunabilir
  status text not null default 'PENDING_PAYMENT'
    check (status in ('PENDING_PAYMENT','SUBMITTED','APPROVED','REJECTED','CHECKED_IN')),
  receipt_url text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)   -- bir öğrenci bir etkinliğe tek bilet
);

create index if not exists tickets_event_idx on public.tickets(event_id);
create index if not exists tickets_user_idx  on public.tickets(user_id);

alter table public.tickets enable row level security;

-- 4) Kolon-grant: status/token/receipt/review DOĞRUDAN yazılamaz ----------
revoke all on public.tickets from authenticated;
grant select on public.tickets to authenticated;
grant insert (event_id, user_id) on public.tickets to authenticated;  -- yalnız talep açma
grant delete on public.tickets to authenticated;                       -- PENDING iken iptal

-- 5) RLS ------------------------------------------------------------------
-- SELECT: kendi bileti VEYA o kulübün yetkilisi
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1 from public.events e
    where e.id = tickets.event_id
      and (public.is_club_admin(e.club_id) or public.is_club_advisor(e.club_id))
  )
);

-- INSERT: sadece kendi adına, PENDING_PAYMENT (status default zaten)
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert to authenticated
with check (user_id = auth.uid());

-- DELETE: yalnız kendi bileti, henüz ödeme yapılmadıysa
drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete on public.tickets for delete to authenticated
using (user_id = auth.uid() and status = 'PENDING_PAYMENT');

-- 6) RPC'ler (SECURITY DEFINER, search_path='') ---------------------------

-- 6a) Öğrenci dekont yükler -> SUBMITTED
drop function if exists public.ticket_submit_receipt(uuid, text);
create function public.ticket_submit_receipt(p_ticket_id uuid, p_receipt_url text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.tickets
     set receipt_url = p_receipt_url,
         status = 'SUBMITTED',
         updated_at = now()
   where id = p_ticket_id
     and user_id = auth.uid()
     and status in ('PENDING_PAYMENT','REJECTED');  -- red sonrası tekrar yükleyebilir
  if not found then
    raise exception 'Bilet bulunamadı veya bu işleme uygun değil';
  end if;
end; $$;

-- 6b) Başkan/okul dekontu onaylar/reddeder
drop function if exists public.ticket_approve(uuid, text, text);
create function public.ticket_approve(p_ticket_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_club_id uuid;
  v_event_id uuid;
  v_capacity integer;
  v_count integer;
begin
  select e.id, e.club_id, e.ticket_capacity
    into v_event_id, v_club_id, v_capacity
  from public.tickets t join public.events e on e.id = t.event_id
  where t.id = p_ticket_id;

  if v_event_id is null then raise exception 'Bilet bulunamadı'; end if;
  if not (public.is_super_admin() or public.is_club_admin(v_club_id)) then
    raise exception 'Yetkisiz';
  end if;

  if p_decision = 'approve' then
    if v_capacity is not null then
      select count(*) into v_count from public.tickets
       where event_id = v_event_id and status in ('APPROVED','CHECKED_IN');
      if v_count >= v_capacity then raise exception 'Kapasite dolu'; end if;
    end if;
    update public.tickets
       set status='APPROVED', reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
     where id=p_ticket_id and status='SUBMITTED';
  elsif p_decision = 'reject' then
    update public.tickets
       set status='REJECTED', reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
     where id=p_ticket_id and status='SUBMITTED';
  else
    raise exception 'Geçersiz karar';
  end if;

  if not found then raise exception 'Bilet onay bekleyen durumda değil'; end if;
end; $$;

-- 6c) Kapıda QR/isim ile giriş
drop function if exists public.ticket_checkin(text);
create function public.ticket_checkin(p_token text)
returns table (ticket_id uuid, full_name text, event_title text)
language plpgsql security definer set search_path = '' as $$
declare
  v_club_id uuid;
  v_status text;
  v_tid uuid;
begin
  select t.id, t.status, e.club_id into v_tid, v_status, v_club_id
  from public.tickets t join public.events e on e.id = t.event_id
  where t.token = upper(p_token);

  if v_tid is null then raise exception 'Geçersiz bilet'; end if;
  if not (public.is_super_admin() or public.is_club_admin(v_club_id) or public.is_club_advisor(v_club_id)) then
    raise exception 'Yetkisiz';
  end if;
  if v_status = 'CHECKED_IN' then raise exception 'Bu bilet zaten kullanıldı'; end if;
  if v_status <> 'APPROVED' then raise exception 'Bilet geçerli değil (onaylı değil)'; end if;

  update public.tickets set status='CHECKED_IN', checked_in_at=now(), updated_at=now()
   where id = v_tid;

  return query
  select t.id, p.full_name, e.title
  from public.tickets t
  join public.profiles p on p.id = t.user_id
  join public.events e on e.id = t.event_id
  where t.id = v_tid;
end; $$;

grant execute on function public.ticket_submit_receipt(uuid, text)   to authenticated;
grant execute on function public.ticket_approve(uuid, text, text)    to authenticated;
grant execute on function public.ticket_checkin(text)                to authenticated;
