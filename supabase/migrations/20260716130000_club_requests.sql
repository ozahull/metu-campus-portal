-- 20260716130000_club_requests
-- Aşama 2/4 — Topluluk açma başvurusu (HOCA başvurur → OKUL onaylar → kulüp oluşur).
--
-- BAĞLAM: Aşama 1'de bağımsız ADVISOR (Hoca) rolü + is_advisor() geldi. Bu
-- aşama, bir HOCA'nın henüz hiçbir kulübe bağlı değilken "topluluk açma
-- başvurusu" yapmasını, SUPER_ADMIN'in onaylayıp GERÇEK kulübü oluşturmasını
-- ve başvuran hocanın o kulübün danışmanı olmasını kurar.
--
-- DESEN: Etkinlik onay akışı (event_submit + event_advisor/school_decision durum
-- makinesi), bildirim üreticileri (push/direct insert) ve belge eki (event-docs
-- bucket + RLS) desenleri BİREBİR taklit edilir. Yazma yolu istemciye KAPALI —
-- club_requests satırları YALNIZCA SECURITY DEFINER RPC'lerle değişir
-- (notifications tablosu deseni). Başkan seçimi bu aşamada DEĞİL (onaydan sonra
-- hoca kendi /manage panelinden ADMIN atar — mevcut ManageMembers/canAssignAdmin).
--
-- İdempotent: create-if-not-exists / drop-if-exists / create-or-replace.

-- ============================================================================
-- 1) notifications type CHECK'ine 'CLUB_REQUEST' ekle (idempotent drop+add).
--    Tek tip; alt-anlam (NEW/APPROVED/REJECTED/CHANGES_REQUESTED) notifications.
--    body'sinde MAKİNE token'ı olarak taşınır (UI o token'ı yerelleştirir).
-- ============================================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'EVENT_APPROVED','EVENT_NEW','EVENT_REMINDER','CLUB_ANNOUNCEMENT','MEMBERSHIP',
  'EVENT_PHOTOS','BADGE_EARNED','CLUB_REQUEST'
));

-- ============================================================================
-- 2) club_requests tablosu
-- ============================================================================
create table if not exists public.club_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  name text not null,                 -- önerilen topluluk adı
  description text,                    -- kısa açıklama
  category text,                       -- kategori
  rationale text,                      -- gerekçe (okulun kararı için)
  status text not null default 'PENDING'
    check (status in ('PENDING','APPROVED','REJECTED','CHANGES_REQUESTED')),
  review_note text,                    -- okulun geri dönüt notu
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_club_id uuid references public.clubs(id) on delete set null,  -- onayda oluşan kulüp
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_requests_requester_idx
  on public.club_requests (requested_by, created_at desc);
create index if not exists club_requests_pending_idx
  on public.club_requests (created_at) where status = 'PENDING';

alter table public.club_requests enable row level security;

-- Kolon-grant: okuma serbest (RLS ile daraltılır), YAZMA YOK — tüm mutasyonlar
-- SECURITY DEFINER RPC'lerle (notifications tablosu deseni; upsert/kolon tuzağı yok).
revoke all on public.club_requests from authenticated;
revoke all on public.club_requests from anon;
grant select on public.club_requests to authenticated;

-- SELECT: HOCA yalnız kendi başvurusunu; SUPER_ADMIN hepsini; USER hiç.
drop policy if exists club_requests_select on public.club_requests;
create policy club_requests_select on public.club_requests
  for select to authenticated
  using (
    (public.is_advisor() and requested_by = auth.uid())
    or public.is_super_admin()
  );

-- ============================================================================
-- 3) club_request_documents tablosu (opsiyonel dosya — event_documents deseni)
-- ============================================================================
create table if not exists public.club_request_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.club_requests(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  file_url text not null,             -- Storage path (club-request-docs)
  file_name text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists club_request_documents_request_idx
  on public.club_request_documents (request_id);

alter table public.club_request_documents enable row level security;

revoke all on public.club_request_documents from authenticated;
revoke all on public.club_request_documents from anon;
grant select on public.club_request_documents to authenticated;
grant insert (request_id, uploaded_by, file_url, file_name, note)
  on public.club_request_documents to authenticated;
grant delete on public.club_request_documents to authenticated;

-- SELECT: yükleyen + başvuru sahibi hoca + okul (signed URL bunun üzerinden).
drop policy if exists club_request_documents_select on public.club_request_documents;
create policy club_request_documents_select on public.club_request_documents
  for select to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.club_requests r
      where r.id = club_request_documents.request_id
        and r.requested_by = auth.uid()
    )
  );

-- INSERT: başvuru sahibi hoca (kendi başvurusuna) veya okul (geri dönüt dosyası),
-- kendi adına.
drop policy if exists club_request_documents_insert on public.club_request_documents;
create policy club_request_documents_insert on public.club_request_documents
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.club_requests r
        where r.id = club_request_documents.request_id
          and r.requested_by = auth.uid()
      )
    )
  );

-- DELETE: yalnız yükleyen kendi belgesini siler.
drop policy if exists club_request_documents_delete on public.club_request_documents;
create policy club_request_documents_delete on public.club_request_documents
  for delete to authenticated
  using (uploaded_by = auth.uid());

-- ============================================================================
-- 4) Durum makinesi RPC'leri (SECURITY DEFINER; yetki + durum içeride)
-- ============================================================================

-- (a) Başvuru gönder — HOCA yeni başvuru açar → PENDING + okula bildirim.
create or replace function public.club_request_submit(
  p_name text,
  p_description text,
  p_category text,
  p_rationale text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_advisor() then
    raise exception 'Yalnızca hocalar topluluk açma başvurusu yapabilir.';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Topluluk adı gerekli.';
  end if;
  if coalesce(btrim(p_rationale), '') = '' then
    raise exception 'Gerekçe gerekli.';
  end if;

  insert into public.club_requests
    (requested_by, name, description, category, rationale, status)
  values (
    auth.uid(),
    btrim(p_name),
    nullif(btrim(p_description), ''),
    nullif(btrim(p_category), ''),
    btrim(p_rationale),
    'PENDING'
  )
  returning id into v_id;

  -- OKUL yönetimine (tüm SUPER_ADMIN) yeni başvuru bildirimi. İşlemsel/kişisel
  -- olduğundan tercihten bağımsız DOĞRUDAN insert. body = 'NEW' (UI yerelleştirir).
  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  select p.id, 'CLUB_REQUEST', btrim(p_name), 'NEW', '/admin', null, null
  from public.profiles p
  where upper(btrim(p.role::text)) = 'SUPER_ADMIN';

  return v_id;
end;
$$;

-- (b) Revizyon sonrası tekrar gönder — CHANGES_REQUESTED → PENDING (event_submit
--     deseni: içerik güncellenir + akışa tekrar girer + okula bildirim).
create or replace function public.club_request_resubmit(
  p_request_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_rationale text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_owner uuid;
  v_name text;
begin
  select status, requested_by into v_status, v_owner
    from public.club_requests where id = p_request_id;
  if v_owner is null then
    raise exception 'Başvuru bulunamadı.';
  end if;
  if v_owner <> auth.uid() or not public.is_advisor() then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;
  if v_status <> 'CHANGES_REQUESTED' then
    raise exception 'Başvuru revizyon durumunda değil.';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Topluluk adı gerekli.';
  end if;
  if coalesce(btrim(p_rationale), '') = '' then
    raise exception 'Gerekçe gerekli.';
  end if;

  update public.club_requests
    set name = btrim(p_name),
        description = nullif(btrim(p_description), ''),
        category = nullif(btrim(p_category), ''),
        rationale = btrim(p_rationale),
        status = 'PENDING',
        review_note = null,
        updated_at = now()
    where id = p_request_id
    returning name into v_name;

  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  select p.id, 'CLUB_REQUEST', v_name, 'NEW', '/admin', null, null
  from public.profiles p
  where upper(btrim(p.role::text)) = 'SUPER_ADMIN';

  return 'PENDING';
end;
$$;

-- (c) Okul kararı — PENDING → APPROVED (kulüp oluşur) / REJECTED / CHANGES_REQUESTED
--     (event_school_decision deseni). Onayda clubs INSERT + advisor_id=başvuran.
create or replace function public.club_request_decide(
  p_request_id uuid,
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
  v_requester uuid;
  v_name text;
  v_description text;
  v_category text;
  v_new text;
  v_club_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;

  select status, requested_by, name, description, category
    into v_status, v_requester, v_name, v_description, v_category
    from public.club_requests where id = p_request_id;
  if v_requester is null then
    raise exception 'Başvuru bulunamadı.';
  end if;
  if v_status <> 'PENDING' then
    raise exception 'Başvuru beklemede değil.';
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

  if v_new = 'APPROVED' then
    -- GERÇEK kulüp oluştur; başvuran HOCA o kulübün danışmanı olur.
    -- (advisor_id INSERT'te serbest — prevent_advisor_change yalnız UPDATE'i kilitler.)
    insert into public.clubs (name, description, category, advisor_id)
    values (v_name, v_description, v_category, v_requester)
    returning id into v_club_id;

    update public.club_requests
      set status = 'APPROVED',
          review_note = p_note,
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          created_club_id = v_club_id,
          updated_at = now()
      where id = p_request_id;

    -- Başvurana onay bildirimi (işlemsel → doğrudan insert). Yeni kulübe linkli.
    insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
    values (v_requester, 'CLUB_REQUEST', v_name, 'APPROVED',
            '/clubs/' || v_club_id::text, v_club_id, null);
  else
    update public.club_requests
      set status = v_new,
          review_note = p_note,
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          updated_at = now()
      where id = p_request_id;

    -- Başvurana red/revizyon bildirimi. Revizyonda başvuru sayfasına yönlendir.
    insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
    values (v_requester, 'CLUB_REQUEST', v_name, v_new, '/clubs/new', null, null);
  end if;

  return v_new;
end;
$$;

grant execute on function public.club_request_submit(text, text, text, text) to authenticated;
grant execute on function public.club_request_resubmit(uuid, text, text, text, text) to authenticated;
grant execute on function public.club_request_decide(uuid, text, text) to authenticated;

-- ============================================================================
-- 5) Storage policy: club-request-docs bucket (event-docs deseninin kopyası).
--    ⚠️ BUCKET'ı Supabase panelinden PRIVATE olarak elle oluştur (event-docs
--    gibi). Aşağıdaki RLS policy'leri storage.objects üzerinde tanımlanır.
--    Path deseni: ${request_id}/${uploaded_by}-${timestamp}.ext (erişim signed URL).
-- ============================================================================

-- INSERT: başvuru sahibi hoca (kendi başvurusuna) veya okul, kendi adına.
drop policy if exists "clubreqdocs_insert" on storage.objects;
create policy "clubreqdocs_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'club-request-docs'
  and storage.filename(name) like auth.uid()::text || '-%'
  and (
    public.is_super_admin()
    or exists (
      select 1 from public.club_requests r
      where r.id::text = (storage.foldername(name))[1]
        and r.requested_by = auth.uid()
    )
  )
);

-- SELECT: yükleyen + başvuru sahibi hoca + okul (signed URL bunun üzerinden).
drop policy if exists "clubreqdocs_select" on storage.objects;
create policy "clubreqdocs_select" on storage.objects for select to authenticated
using (
  bucket_id = 'club-request-docs'
  and (
    owner = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.club_requests r
      where r.id::text = (storage.foldername(name))[1]
        and r.requested_by = auth.uid()
    )
  )
);
