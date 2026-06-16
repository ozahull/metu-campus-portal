-- Faz 2 — Etkinlik onay akışı (iki kapı: danışman → okul).
-- Etkinlik artık otomatik APPROVED değil. Başlangıç:
--   clubs.requires_advisor_approval = true VE advisor_id varsa → PENDING_ADVISOR
--   aksi halde → PENDING_SCHOOL.

-- ----------------------------------------------------------------------------
-- 1) clubs.requires_advisor_approval (yalnızca okul değiştirebilir)
-- ----------------------------------------------------------------------------
alter table public.clubs
  add column if not exists requires_advisor_approval boolean not null default true;

-- prevent_advisor_change trigger'ını genişlet: advisor_id VE
-- requires_advisor_approval değişimi yalnızca SUPER_ADMIN'e (veya service_role).
create or replace function public.prevent_advisor_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
        new.advisor_id is distinct from old.advisor_id
        or new.requires_advisor_approval is distinct from old.requires_advisor_approval
     )
     and auth.uid() is not null
     and not public.is_super_admin() then
    raise exception 'Danışman ve onay ayarını yalnızca okul yönetimi değiştirebilir.';
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) events inceleme alanları
-- ----------------------------------------------------------------------------
alter table public.events add column if not exists review_note text;
alter table public.events add column if not exists reviewed_by uuid references public.profiles (id);
alter table public.events add column if not exists reviewed_at timestamptz;

-- Güvenli default: doğrudan eklenen etkinlik APPROVED olarak öğrenciye sızmasın.
alter table public.events alter column status set default 'PENDING_SCHOOL';

-- ----------------------------------------------------------------------------
-- 3) events SELECT: yöneticiler kendi kulüplerinin bekleyen etkinliklerini görsün
-- ----------------------------------------------------------------------------
drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events
  for select
  using (
    status = 'APPROVED'
    or public.is_super_admin()
    or public.is_club_advisor(club_id)
    or public.is_club_admin(club_id)
  );

-- ----------------------------------------------------------------------------
-- 4) Durum geçişi RPC'leri (SECURITY DEFINER; yetki + durum doğrulaması içeride)
-- ----------------------------------------------------------------------------

-- Etkinliği akışa sok (oluşturma veya revizyon sonrası tekrar gönderme).
create or replace function public.event_submit(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_requires boolean;
  v_advisor uuid;
  v_new text;
begin
  select club_id into v_club_id from public.events where id = p_event_id;
  if v_club_id is null then
    raise exception 'Etkinlik bulunamadı.';
  end if;

  if not (
       public.is_super_admin()
       or public.is_club_advisor(v_club_id)
       or public.is_club_admin(v_club_id)
     ) then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;

  select requires_advisor_approval, advisor_id
    into v_requires, v_advisor
    from public.clubs where id = v_club_id;

  if v_requires and v_advisor is not null then
    v_new := 'PENDING_ADVISOR';
  else
    v_new := 'PENDING_SCHOOL';
  end if;

  update public.events
    set status = v_new,
        review_note = null,
        reviewed_by = null,
        reviewed_at = null
    where id = p_event_id;

  return v_new;
end;
$$;

-- Danışman kararı: PENDING_ADVISOR → PENDING_SCHOOL / REJECTED / CHANGES_REQUESTED
create or replace function public.event_advisor_decision(
  p_event_id uuid,
  p_decision text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_status text;
  v_new text;
begin
  select club_id, status into v_club_id, v_status
    from public.events where id = p_event_id;
  if v_club_id is null then
    raise exception 'Etkinlik bulunamadı.';
  end if;

  if not (public.is_super_admin() or public.is_club_advisor(v_club_id)) then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;

  if v_status <> 'PENDING_ADVISOR' then
    raise exception 'Etkinlik danışman onayında değil.';
  end if;

  v_new := case p_decision
    when 'approve' then 'PENDING_SCHOOL'
    when 'reject'  then 'REJECTED'
    when 'changes' then 'CHANGES_REQUESTED'
    else null
  end;
  if v_new is null then
    raise exception 'Geçersiz karar.';
  end if;

  update public.events
    set status = v_new,
        review_note = p_note,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_event_id;

  return v_new;
end;
$$;

-- Okul kararı: PENDING_SCHOOL → APPROVED / REJECTED / CHANGES_REQUESTED
create or replace function public.event_school_decision(
  p_event_id uuid,
  p_decision text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_new text;
begin
  if not public.is_super_admin() then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;

  select status into v_status from public.events where id = p_event_id;
  if v_status is null then
    raise exception 'Etkinlik bulunamadı.';
  end if;
  if v_status <> 'PENDING_SCHOOL' then
    raise exception 'Etkinlik okul onayında değil.';
  end if;

  v_new := case p_decision
    when 'approve' then 'APPROVED'
    when 'reject'  then 'REJECTED'
    when 'changes' then 'CHANGES_REQUESTED'
    else null
  end;
  if v_new is null then
    raise exception 'Geçersiz karar.';
  end if;

  update public.events
    set status = v_new,
        review_note = p_note,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_event_id;

  return v_new;
end;
$$;

grant execute on function public.event_submit(uuid) to authenticated;
grant execute on function public.event_advisor_decision(uuid, text, text) to authenticated;
grant execute on function public.event_school_decision(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) GÜVENLİK — status ve inceleme alanlarını DOĞRUDAN yazılamaz yap.
--    Kullanıcılar yalnızca içerik kolonlarını yazabilir; status geçişleri
--    yalnızca RPC'ler (owner/SECURITY DEFINER) üzerinden olur.
-- ----------------------------------------------------------------------------
revoke insert, update on public.events from authenticated;
grant insert (club_id, title, description, event_date, location)
  on public.events to authenticated;
grant update (title, description, event_date, location)
  on public.events to authenticated;

revoke insert, update on public.events from anon;
