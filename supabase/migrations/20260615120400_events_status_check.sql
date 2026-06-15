-- Faz 0 / Adım 4 — events.status için CHECK constraint (yalnızca ŞEMA).
-- Onay akışı MANTIĞI Faz 2'de gelecek. Mevcut satırlar ve insert default'u
-- ŞİMDİLİK 'APPROVED' kalır; öğrenci tarafı sorguları (status='APPROVED')
-- aynen çalışır.
--
-- İzin verilen değerler:
--   PENDING_ADVISOR, PENDING_SCHOOL, APPROVED, REJECTED, CHANGES_REQUESTED

-- Olası bozuk/eski değerleri yakalamak için önce mevcut dışı değerleri
-- güvenli tarafa çek (yalnızca beklenmeyen bir değer varsa devreye girer).
update public.events
  set status = 'APPROVED'
  where status is null
     or status not in (
       'PENDING_ADVISOR', 'PENDING_SCHOOL', 'APPROVED',
       'REJECTED', 'CHANGES_REQUESTED'
     );

alter table public.events
  drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check check (
    status in (
      'PENDING_ADVISOR', 'PENDING_SCHOOL', 'APPROVED',
      'REJECTED', 'CHANGES_REQUESTED'
    )
  );
