-- 20260714120000_notifications
-- Faz 7A — Uygulama içi bildirim sistemi (Web Push/PWA Faz 7b'de; şema onu
-- düşünerek tasarlandı: EVENT_REMINDER tipi şimdiden ayrılmış, hatırlatıcı
-- üreticisi Faz 7b'de eklenecek).
--
-- KURAL: bildirimler YALNIZCA SECURITY DEFINER fonksiyon/trigger'larla yazılır.
-- authenticated'a INSERT/DELETE VERİLMEZ; UPDATE yalnızca read_at kolonunda.
-- (profiles desenindeki hataya düşme: kolon grant'ları dar, id/user_id'ye
-- UPDATE yok, istemciden upsert yok.)

-- ============================================================================
-- 1) notifications tablosu
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'EVENT_APPROVED','EVENT_NEW','EVENT_REMINDER','CLUB_ANNOUNCEMENT','MEMBERSHIP'
  )),
  title text not null,            -- veri: etkinlik/kulüp adı veya duyuru başlığı
  body text,                      -- serbest metin (duyuru gövdesi); sistem tipinde null
  link text,                      -- uygulama içi yol (/events/..) veya dış URL (duyuru)
  club_id uuid references public.clubs(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

-- Kolon-grant: okuma serbest (kendi satırı), yazma yok, güncelleme yalnız read_at.
revoke all on public.notifications from authenticated;
revoke all on public.notifications from anon;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- UPDATE yalnız kendi satırı (okundu işaretleme). Kolon-grant zaten read_at'e
-- kısıtladığı için başka kolon değiştirilemez.
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- 2) notification_preferences tablosu
-- ============================================================================
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  scope text not null default 'MEMBER_CLUBS'
    check (scope in ('MEMBER_CLUBS','ALL','NONE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- Yazma yalnızca set_notification_preference RPC'si (SECURITY DEFINER) ile.
-- İstemciye insert/update grant'ı VERİLMEZ (upsert tuzağına düşmemek için).
revoke all on public.notification_preferences from authenticated;
revoke all on public.notification_preferences from anon;
grant select on public.notification_preferences to authenticated;

drop policy if exists notif_prefs_select on public.notification_preferences;
create policy notif_prefs_select on public.notification_preferences
  for select to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- 3) Yardımcılar (SECURITY DEFINER)
-- ============================================================================

-- Kullanıcı, verilen kulüp bağlamındaki bir bildirimi almak istiyor mu?
-- Tercih satırı yoksa varsayılan MEMBER_CLUBS. MEMBER_CLUBS: yalnızca üyesi
-- (veya danışmanı) olduğu kulüplerden; club_id null ise (kişisel) her zaman.
create or replace function public.user_wants_notification(p_user uuid, p_club uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select case coalesce(
      (select scope from public.notification_preferences where user_id = p_user),
      'MEMBER_CLUBS')
    when 'NONE' then false
    when 'ALL'  then true
    else (
      p_club is null
      or exists (
        select 1 from public.club_members m
        where m.user_id = p_user and m.club_id = p_club
      )
      or exists (
        select 1 from public.clubs c
        where c.id = p_club and c.advisor_id = p_user
      )
    )
  end;
$$;

-- Tercihe saygı göstererek tek bir bildirim üretir (izin yoksa sessizce atlar).
create or replace function public.push_notification(
  p_user uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_club uuid,
  p_event uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null then return; end if;
  if not public.user_wants_notification(p_user, p_club) then return; end if;
  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  values (p_user, p_type, p_title, p_body, p_link, p_club, p_event);
end;
$$;

-- ============================================================================
-- 4) Üretici: etkinlik APPROVED olunca (event_school_decision UPDATE tetikler)
--    - başkan(lar) + danışman → EVENT_APPROVED
--    - diğer üyeler → EVENT_NEW
-- ============================================================================
create or replace function public.on_event_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_advisor uuid;
  v_link text := '/events/' || new.id::text;
begin
  select advisor_id into v_advisor from public.clubs where id = new.club_id;

  -- Üyeler (başkan dışındakiler): yeni etkinlik duyurusu
  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  select m.user_id, 'EVENT_NEW', new.title, null, v_link, new.club_id, new.id
  from public.club_members m
  where m.club_id = new.club_id
    and upper(m.role) <> 'ADMIN'
    and public.user_wants_notification(m.user_id, new.club_id);

  -- Başkan(lar): etkinlik onaylandı bilgisi
  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  select m.user_id, 'EVENT_APPROVED', new.title, null, v_link, new.club_id, new.id
  from public.club_members m
  where m.club_id = new.club_id
    and upper(m.role) = 'ADMIN'
    and public.user_wants_notification(m.user_id, new.club_id);

  -- Danışman (üye olmayabilir)
  if v_advisor is not null then
    perform public.push_notification(
      v_advisor, 'EVENT_APPROVED', new.title, null, v_link, new.club_id, new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists events_notify_approved on public.events;
create trigger events_notify_approved
  after update on public.events
  for each row
  when (new.status = 'APPROVED' and old.status is distinct from 'APPROVED')
  execute function public.on_event_approved();

-- ============================================================================
-- 5) Üretici: kulübe üye katılınca → hoş geldin bildirimi
-- ============================================================================
create or replace function public.on_member_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select name into v_name from public.clubs where id = new.club_id;
  perform public.push_notification(
    new.user_id, 'MEMBERSHIP', v_name, null,
    '/clubs/' || new.club_id::text, new.club_id, null
  );
  return new;
end;
$$;

drop trigger if exists club_members_notify_join on public.club_members;
create trigger club_members_notify_join
  after insert on public.club_members
  for each row
  execute function public.on_member_joined();

-- ============================================================================
-- 6) Tercih ayarı RPC'si (upsert SECURITY DEFINER içinde — istemci doğrudan
--    yazmaz, böylece kolon-grant/upsert tuzağı yok)
-- ============================================================================
create or replace function public.set_notification_preference(p_scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Oturum bulunamadı.'; end if;
  if p_scope not in ('MEMBER_CLUBS','ALL','NONE') then
    raise exception 'Geçersiz tercih.';
  end if;
  insert into public.notification_preferences (user_id, scope)
  values (auth.uid(), p_scope)
  on conflict (user_id) do update
    set scope = excluded.scope, updated_at = now();
end;
$$;

grant execute on function public.set_notification_preference(text) to authenticated;

-- ============================================================================
-- 7) Realtime: zil sayacının canlı güncellenmesi için notifications INSERT'leri
--    supabase_realtime publication'ına eklenir (RLS realtime'da da geçerli).
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
