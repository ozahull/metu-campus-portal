-- 20260617140000_event_documents
-- Faz 5: Etkinlik belge eki (başkan yükler, onay zinciri görür)

-- 1) Tablo ----------------------------------------------------------------
create table if not exists public.event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  file_url text not null,     -- Storage path (event-docs)
  file_name text not null,    -- görünen ad
  note text,                  -- başkanın açıklaması (opsiyonel)
  created_at timestamptz not null default now()
);

create index if not exists event_documents_event_idx on public.event_documents(event_id);

alter table public.event_documents enable row level security;

-- 2) Kolon-grant ----------------------------------------------------------
revoke all on public.event_documents from authenticated;
grant select on public.event_documents to authenticated;
grant insert (event_id, uploaded_by, file_url, file_name, note) on public.event_documents to authenticated;
grant delete on public.event_documents to authenticated;

-- 3) RLS ------------------------------------------------------------------
-- SELECT: yükleyen + o kulübün başkanı/danışmanı + okul
drop policy if exists event_documents_select on public.event_documents;
create policy event_documents_select on public.event_documents for select to authenticated
using (
  uploaded_by = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1 from public.events e
    where e.id = event_documents.event_id
      and (public.is_club_admin(e.club_id) or public.is_club_advisor(e.club_id))
  )
);

-- INSERT: yalnız o kulübün başkanı (veya okul override), kendi adına
drop policy if exists event_documents_insert on public.event_documents;
create policy event_documents_insert on public.event_documents for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.events e
    where e.id = event_documents.event_id
      and (public.is_club_admin(e.club_id) or public.is_super_admin())
  )
);

-- DELETE: yalnız yükleyen kendi belgesini siler
drop policy if exists event_documents_delete on public.event_documents;
create policy event_documents_delete on public.event_documents for delete to authenticated
using (uploaded_by = auth.uid());

-- 4) Storage policy: event-docs bucket -----------------------------------
-- path deseni: ${event_id}/${uploaded_by}-${timestamp}.ext

-- INSERT: yalnız başkan/okul, kendi adına, o etkinliğin kulübüne
drop policy if exists "eventdocs_insert" on storage.objects;
create policy "eventdocs_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-docs'
  and storage.filename(name) like auth.uid()::text || '-%'
  and exists (
    select 1 from public.events e
    where e.id::text = (storage.foldername(name))[1]
      and (public.is_club_admin(e.club_id) or public.is_super_admin())
  )
);

-- SELECT: yükleyen + kulüp başkanı/danışmanı + okul (signed URL bunun üzerinden)
drop policy if exists "eventdocs_select" on storage.objects;
create policy "eventdocs_select" on storage.objects for select to authenticated
using (
  bucket_id = 'event-docs'
  and (
    owner = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and (public.is_super_admin() or public.is_club_admin(e.club_id) or public.is_club_advisor(e.club_id))
    )
  )
);
