-- 20260717120000_fix_club_request_docs_rls
-- Aşama 2 düzeltmesi — club_request belge yüklemesi RLS'e takılıyordu (42501).
--
-- KÖK SEBEP (RLS-içinde-RLS bağımlılığı):
-- 20260716130000_club_requests.sql'deki storage.objects (clubreqdocs_insert/
-- select) ve public.club_request_documents (insert/select) policy'leri, sahiplik
-- kontrolünü GÖMÜLÜ bir alt-sorgu ile yapıyordu:
--
--   exists (select 1 from public.club_requests r
--           where r.id = ... and r.requested_by = auth.uid())
--
-- Bu alt-sorgu, gömülü RLS değerlendirmesinde club_requests'in KENDİ kısıtlı
-- SELECT policy'sine tabidir:
--   ((is_advisor() and requested_by = auth.uid()) or is_super_admin())
-- Başvuran hoca için bu policy satırı görünür OLMASI beklenir; ancak RLS
-- alt-sorgusu policy zincirinde beklenmedik biçimde satırı göremiyor → exists
-- FALSE → insert/select reddediliyor (42501 new row violates row-level security).
--
-- ASİMETRİ (neden event-docs'ta bu bug yok):
-- event_documents policy'leri de aynı deseni (exists ... from public.events)
-- kullanır AMA events tablosu authenticated'a SERBEST okunur (SELECT policy
-- geniş). Dolayısıyla gömülü alt-sorgu satırı görebiliyor. club_requests ise
-- KISITLI okunur (yalnız kendi + super), o yüzden aynı desen sessizce kırıldı.
--
-- ÇÖZÜM:
-- Sahiplik kontrolünü, club_requests SELECT RLS'ini BYPASS eden bir
-- SECURITY DEFINER yardımcı fonksiyona (owns_club_request) taşı. Fonksiyon
-- sahibi (definer) yetkisiyle çalıştığı için tabloyu RLS'siz okur; is_super_admin
-- / is_club_admin / is_club_advisor helper'larıyla BİREBİR aynı desen.
-- search_path = '' ile şema-enjeksiyonuna kapalı (tüm nesneler tam nitelenmiş).
--
-- NOT (idempotent + canlı senkron): Bu migration CANLIYA ELLE ZATEN UYGULANDI.
-- create-or-replace + drop-if-exists desenleri sayesinde `db push` sırasında
-- tekrar çalışması güvenlidir; aynı son duruma yakınsar (yeniden çalıştırılabilir).

-- ============================================================================
-- 1) owns_club_request(p_request_id) — SECURITY DEFINER sahiplik kontrolü.
--    club_requests'in kısıtlı SELECT RLS'ini bypass eder (RLS-içinde-RLS bug fix).
-- ============================================================================
create or replace function public.owns_club_request(p_request_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.club_requests r
    where r.id = p_request_id
      and r.requested_by = auth.uid()
  );
$$;

-- RLS politikalarında kullanılabilmesi için execute yetkisi (idempotent).
grant execute on function public.owns_club_request(uuid) to authenticated;

-- ============================================================================
-- 2) club_request_documents policy'leri — gömülü exists() yerine helper.
--    (SELECT: yükleyen + başvuru sahibi hoca + okul. INSERT: sahip/okul, kendi adına.)
-- ============================================================================
drop policy if exists club_request_documents_select on public.club_request_documents;
create policy club_request_documents_select on public.club_request_documents
  for select to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_super_admin()
    or public.owns_club_request(request_id)
  );

drop policy if exists club_request_documents_insert on public.club_request_documents;
create policy club_request_documents_insert on public.club_request_documents
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_super_admin()
      or public.owns_club_request(request_id)
    )
  );

-- ============================================================================
-- 3) storage.objects policy'leri (club-request-docs bucket) — aynı düzeltme.
--    Path deseni: ${request_id}/${uploaded_by}-${timestamp}.ext.
--    Klasör adı (request_id) uuid'ye cast edilip helper'a verilir.
-- ============================================================================
drop policy if exists "clubreqdocs_insert" on storage.objects;
create policy "clubreqdocs_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'club-request-docs'
  and storage.filename(name) like auth.uid()::text || '-%'
  and (
    public.is_super_admin()
    or public.owns_club_request(((storage.foldername(name))[1])::uuid)
  )
);

drop policy if exists "clubreqdocs_select" on storage.objects;
create policy "clubreqdocs_select" on storage.objects for select to authenticated
using (
  bucket_id = 'club-request-docs'
  and (
    owner = auth.uid()
    or public.is_super_admin()
    or public.owns_club_request(((storage.foldername(name))[1])::uuid)
  )
);
