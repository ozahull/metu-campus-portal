-- 20260718120000_messaging
-- Aşama 4 / Commit 4A — Hiyerarşik mesajlaşma DB katmanı (UI 4B/4C'de).
--
-- MODEL: Kanallar KİŞİLER arası değil ROLLER arasıdır (rol sahibi değişse de
-- kanal ve geçmişi kalır). Üç kanal tipi:
--   • ADMIN_ADVISOR     — okul yönetimi ↔ danışman (danışman başına 1 kanal)
--   • ADVISOR_PRESIDENT — danışman ↔ başkan(lar)   (kulüp başına 1 kanal)
--   • ADMIN_PRESIDENT   — okul yönetimi → başkan(lar) (kulüp başına 1 kanal;
--     TEK YÖN: başkan okur ama YAZAMAZ, kanalı da açamaz)
--
-- GÜVENLİK DESENİ:
--   - Tüm cross-table kontroller SECURITY DEFINER + set search_path=''
--     (RLS-içinde-RLS özyineleme tuzağı yok).
--   - conversations istemciden YAZILMAZ (insert grant yok) — satırı yalnız
--     open_conversation RPC'si (definer) açar.
--   - messages insert kolon-grant ile (conversation_id, body):
--     sender_user_id DEFAULT auth.uid() ile dolar, istemci gönderemez;
--     policy ayrıca sender_user_id = auth.uid() doğrular.
--   - conversation_reads TABLO düzeyi grant: PostgREST upsert'i PK
--     kolonlarında da UPDATE yetkisi ister (profiles upsert tuzağının
--     bilinçli istisnası); RLS user_id = auth.uid() ile satırı kilitler.
--
-- İdempotent: if not exists / create or replace / drop ... if exists.

-- ============================================================================
-- 1) conversations — rol-bazlı kanallar
-- ============================================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null
    check (type in ('ADMIN_ADVISOR','ADVISOR_PRESIDENT','ADMIN_PRESIDENT')),
  -- ADMIN_ADVISOR kanalının danışman tarafı; diğer tiplerde null
  advisor_user_id uuid references public.profiles(id) on delete cascade,
  -- Kulüp kanallarının bağlamı (ADVISOR_PRESIDENT / ADMIN_PRESIDENT); ADMIN_ADVISOR'da null
  club_id uuid references public.clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint conversations_shape_check check (
    (type = 'ADMIN_ADVISOR' and advisor_user_id is not null and club_id is null)
    or (type in ('ADVISOR_PRESIDENT','ADMIN_PRESIDENT')
        and club_id is not null and advisor_user_id is null)
  )
);

-- Kanal tekilliği: danışman başına 1 ADMIN_ADVISOR; kulüp başına 1'er
-- ADVISOR_PRESIDENT ve ADMIN_PRESIDENT. open_conversation'ın
-- "on conflict do nothing" yarış güvenliği bu index'lere dayanır.
create unique index if not exists conversations_admin_advisor_uniq
  on public.conversations (advisor_user_id) where type = 'ADMIN_ADVISOR';
create unique index if not exists conversations_advisor_president_uniq
  on public.conversations (club_id) where type = 'ADVISOR_PRESIDENT';
create unique index if not exists conversations_admin_president_uniq
  on public.conversations (club_id) where type = 'ADMIN_PRESIDENT';

-- ============================================================================
-- 2) messages
-- ============================================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations(id) on delete cascade,
  sender_user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- ============================================================================
-- 3) conversation_reads — okundu imleci (kanal+kullanıcı başına tek satır)
-- ============================================================================
create table if not exists public.conversation_reads (
  conversation_id uuid not null
    references public.conversations(id) on delete cascade,
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ============================================================================
-- 4) Yardımcılar (SECURITY DEFINER, search_path='', stable)
--    is_advisor_of_club / is_president_of_club mesajlaşma katmanının adlarıdır;
--    yetki sorgusunun TEK kaynağı mevcut is_club_advisor / is_club_admin'dir —
--    buradaki wrapper'lar yalnızca delege eder (tanım değişirse otomatik izler).
-- ============================================================================
create or replace function public.is_advisor_of_club(p_club uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.is_club_advisor(p_club);
$$;

create or replace function public.is_president_of_club(p_club uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.is_club_admin(p_club);
$$;

-- Kanalı OKUYABİLİR mi? (tipine göre rol kontrolü)
create or replace function public.can_access_conversation(p_conv uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conv
      and case c.type
            when 'ADMIN_ADVISOR' then
              public.is_super_admin() or c.advisor_user_id = auth.uid()
            when 'ADVISOR_PRESIDENT' then
              public.is_advisor_of_club(c.club_id)
              or public.is_president_of_club(c.club_id)
            when 'ADMIN_PRESIDENT' then
              public.is_super_admin() or public.is_president_of_club(c.club_id)
            else false
          end
  );
$$;

-- Kanala YAZABİLİR mi? ADMIN_PRESIDENT tek yön: yalnız okul yazar,
-- başkan false alır (okur ama yanıtlayamaz).
create or replace function public.can_write_conversation(p_conv uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conv
      and case c.type
            when 'ADMIN_ADVISOR' then
              public.is_super_admin() or c.advisor_user_id = auth.uid()
            when 'ADVISOR_PRESIDENT' then
              public.is_advisor_of_club(c.club_id)
              or public.is_president_of_club(c.club_id)
            when 'ADMIN_PRESIDENT' then
              public.is_super_admin()
            else false
          end
  );
$$;

-- ============================================================================
-- 5) RLS + grant'lar
-- ============================================================================
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;

revoke all on public.conversations from authenticated;
revoke all on public.conversations from anon;
revoke all on public.messages from authenticated;
revoke all on public.messages from anon;
revoke all on public.conversation_reads from authenticated;
revoke all on public.conversation_reads from anon;

-- conversations: yalnız okuma; INSERT grant'ı bilinçli YOK (open_conversation).
grant select on public.conversations to authenticated;
-- messages: okuma + kolon-kısıtlı yazma (sender/created_at DEFAULT ile dolar).
grant select on public.messages to authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;
-- conversation_reads: upsert için tablo düzeyi (bkz. başlık notu).
grant select, insert, update on public.conversation_reads to authenticated;

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated
  using (public.can_access_conversation(id));

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (public.can_access_conversation(conversation_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and public.can_write_conversation(conversation_id)
  );

drop policy if exists conversation_reads_select on public.conversation_reads;
create policy conversation_reads_select on public.conversation_reads
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists conversation_reads_insert on public.conversation_reads;
create policy conversation_reads_insert on public.conversation_reads
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_access_conversation(conversation_id)
  );

drop policy if exists conversation_reads_update on public.conversation_reads;
create policy conversation_reads_update on public.conversation_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.can_access_conversation(conversation_id)
  );

-- ============================================================================
-- 6) open_conversation — kanalı aç/getir (tek yazma yolu, definer)
-- ============================================================================
create or replace function public.open_conversation(
  p_type text,
  p_club_id uuid default null,
  p_advisor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Oturum bulunamadı.'; end if;

  if p_type = 'ADMIN_ADVISOR' then
    if p_advisor_user_id is null then
      raise exception 'Danışman belirtilmedi.';
    end if;
    if not (public.is_super_admin() or auth.uid() = p_advisor_user_id) then
      raise exception 'Bu kanalı açma yetkiniz yok.';
    end if;
    if not exists (
      select 1 from public.clubs c where c.advisor_id = p_advisor_user_id
    ) then
      raise exception 'Kullanıcı bir kulübün danışmanı değil.';
    end if;

    select c.id into v_id from public.conversations c
     where c.type = 'ADMIN_ADVISOR' and c.advisor_user_id = p_advisor_user_id;
    if v_id is null then
      insert into public.conversations (type, advisor_user_id)
      values ('ADMIN_ADVISOR', p_advisor_user_id)
      on conflict do nothing;
      select c.id into v_id from public.conversations c
       where c.type = 'ADMIN_ADVISOR' and c.advisor_user_id = p_advisor_user_id;
    end if;
    return v_id;

  elsif p_type = 'ADVISOR_PRESIDENT' then
    if p_club_id is null then raise exception 'Kulüp belirtilmedi.'; end if;
    if not (
      public.is_advisor_of_club(p_club_id)
      or public.is_president_of_club(p_club_id)
    ) then
      raise exception 'Bu kanalı açma yetkiniz yok.';
    end if;

    select c.id into v_id from public.conversations c
     where c.type = 'ADVISOR_PRESIDENT' and c.club_id = p_club_id;
    if v_id is null then
      insert into public.conversations (type, club_id)
      values ('ADVISOR_PRESIDENT', p_club_id)
      on conflict do nothing;
      select c.id into v_id from public.conversations c
       where c.type = 'ADVISOR_PRESIDENT' and c.club_id = p_club_id;
    end if;
    return v_id;

  elsif p_type = 'ADMIN_PRESIDENT' then
    if p_club_id is null then raise exception 'Kulüp belirtilmedi.'; end if;

    select c.id into v_id from public.conversations c
     where c.type = 'ADMIN_PRESIDENT' and c.club_id = p_club_id;

    if public.is_super_admin() then
      if v_id is null then
        insert into public.conversations (type, club_id)
        values ('ADMIN_PRESIDENT', p_club_id)
        on conflict do nothing;
        select c.id into v_id from public.conversations c
         where c.type = 'ADMIN_PRESIDENT' and c.club_id = p_club_id;
      end if;
      return v_id;
    elsif public.is_president_of_club(p_club_id) then
      -- Başkan kanal OLUŞTURAMAZ (tek yön); mevcutsa id, yoksa null döner.
      return v_id;
    else
      raise exception 'Bu kanala erişim yetkiniz yok.';
    end if;

  else
    raise exception 'Geçersiz kanal tipi.';
  end if;
end;
$$;

grant execute on function public.open_conversation(text, uuid, uuid) to authenticated;

-- ============================================================================
-- 7) list_my_conversations — erişilebilir MEVCUT kanallar + son mesaj + unread.
--    counterpart_label: kişi bulunursa full_name; rol-grubu ise MAKİNE token'ı
--    ('SCHOOL_ADMIN' / 'ADVISOR' / 'PRESIDENT') — UI yerelleştirir
--    (club_requests body token deseni).
-- ============================================================================
create or replace function public.list_my_conversations()
returns table (
  conversation_id uuid,
  type text,
  club_id uuid,
  club_name text,
  counterpart_label text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  return query
  select
    c.id,
    c.type,
    c.club_id,
    cl.name,
    case c.type
      when 'ADMIN_ADVISOR' then
        case when c.advisor_user_id = auth.uid() then 'SCHOOL_ADMIN'
        else coalesce(
          (select nullif(btrim(p.full_name), '')
             from public.profiles p where p.id = c.advisor_user_id),
          'ADVISOR')
        end
      when 'ADVISOR_PRESIDENT' then
        case when public.is_advisor_of_club(c.club_id) then coalesce(
          (select string_agg(nullif(btrim(p.full_name), ''), ', '
                             order by p.full_name)
             from public.club_members m
             join public.profiles p on p.id = m.user_id
            where m.club_id = c.club_id
              and upper(btrim(m.role::text)) = 'ADMIN'),
          'PRESIDENT')
        else coalesce(
          (select nullif(btrim(p.full_name), '')
             from public.clubs c2
             join public.profiles p on p.id = c2.advisor_id
            where c2.id = c.club_id),
          'ADVISOR')
        end
      else -- ADMIN_PRESIDENT
        case when public.is_president_of_club(c.club_id) then 'SCHOOL_ADMIN'
        else coalesce(
          (select string_agg(nullif(btrim(p.full_name), ''), ', '
                             order by p.full_name)
             from public.club_members m
             join public.profiles p on p.id = m.user_id
            where m.club_id = c.club_id
              and upper(btrim(m.role::text)) = 'ADMIN'),
          'PRESIDENT')
        end
    end,
    lm.created_at,
    lm.preview,
    coalesce(un.cnt, 0)::int
  from public.conversations c
  left join public.clubs cl on cl.id = c.club_id
  left join lateral (
    select m.created_at, left(btrim(m.body), 120) as preview
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*) as cnt
    from public.messages m
    where m.conversation_id = c.id
      and m.sender_user_id <> auth.uid()
      and m.created_at > coalesce(
        (select r.last_read_at from public.conversation_reads r
          where r.conversation_id = c.id and r.user_id = auth.uid()),
        '-infinity'::timestamptz)
  ) un on true
  where public.can_access_conversation(c.id)
  order by lm.created_at desc nulls last, c.created_at desc;
end;
$$;

grant execute on function public.list_my_conversations() to authenticated;

-- ============================================================================
-- 8) Bildirim: yeni mesaj → GÜNCEL karşı rol-sahiplerine (gönderen hariç).
--    Aşama 2 bildirim sistemi yeniden kullanılır (push_notification +
--    user_wants_notification tercihi). Yeni tip: 'MESSAGE'.
-- ============================================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'EVENT_APPROVED','EVENT_NEW','EVENT_REMINDER','CLUB_ANNOUNCEMENT','MEMBERSHIP',
  'EVENT_PHOTOS','BADGE_EARNED','CLUB_REQUEST','MESSAGE'
));

create or replace function public.on_message_sent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_conv_advisor uuid;   -- ADMIN_ADVISOR kanalının danışmanı
  v_conv_club uuid;
  v_club_advisor uuid;   -- kulübün GÜNCEL danışmanı (clubs.advisor_id)
  v_sender_name text;
  v_title text;
  v_preview text;
  v_link text;
begin
  select c.type, c.advisor_user_id, c.club_id
    into v_type, v_conv_advisor, v_conv_club
  from public.conversations c
  where c.id = new.conversation_id;
  if not found then return new; end if;

  select nullif(btrim(p.full_name), '') into v_sender_name
  from public.profiles p where p.id = new.sender_user_id;
  -- title: gönderen adı; yoksa 'MESSAGE' makine token'ı (UI yerelleştirir).
  v_title := coalesce(v_sender_name, 'MESSAGE');
  v_preview := left(btrim(new.body), 120);
  v_link := '/messages/' || new.conversation_id::text;  -- 4B rotası bu yolu kullanmalı

  if v_type = 'ADMIN_ADVISOR' then
    if new.sender_user_id = v_conv_advisor then
      -- danışman yazdı → tüm okul yöneticilerine
      insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
      select p.id, 'MESSAGE', v_title, v_preview, v_link, null, null
      from public.profiles p
      where upper(btrim(p.role::text)) = 'SUPER_ADMIN'
        and p.id <> new.sender_user_id
        and public.user_wants_notification(p.id, null);
    else
      -- okul yazdı → kanalın danışmanına
      perform public.push_notification(
        v_conv_advisor, 'MESSAGE', v_title, v_preview, v_link, null, null);
    end if;

  elsif v_type = 'ADVISOR_PRESIDENT' then
    select c.advisor_id into v_club_advisor
    from public.clubs c where c.id = v_conv_club;
    if new.sender_user_id = v_club_advisor then
      -- danışman yazdı → başkan(lar)a
      insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
      select m.user_id, 'MESSAGE', v_title, v_preview, v_link, v_conv_club, null
      from public.club_members m
      where m.club_id = v_conv_club
        and upper(btrim(m.role::text)) = 'ADMIN'
        and m.user_id <> new.sender_user_id
        and public.user_wants_notification(m.user_id, v_conv_club);
    else
      -- başkan yazdı → güncel danışmana (null ise push_notification atlar)
      perform public.push_notification(
        v_club_advisor, 'MESSAGE', v_title, v_preview, v_link, v_conv_club, null);
    end if;

  elsif v_type = 'ADMIN_PRESIDENT' then
    -- yalnız okul yazabilir (can_write) → başkan(lar)a
    insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
    select m.user_id, 'MESSAGE', v_title, v_preview, v_link, v_conv_club, null
    from public.club_members m
    where m.club_id = v_conv_club
      and upper(btrim(m.role::text)) = 'ADMIN'
      and m.user_id <> new.sender_user_id
      and public.user_wants_notification(m.user_id, v_conv_club);
  end if;

  return new;
end;
$$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
  after insert on public.messages
  for each row
  execute function public.on_message_sent();
