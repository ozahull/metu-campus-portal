-- 20260715140000_remove_payment_layer
-- Ödeme/para katmanının ŞEMA temizliği (EN SON adım — Commit 5/5).
-- UI referansları önceki commit'lerde kaldırıldı; burada kolon/durum/RPC düşer.
--
-- SİLİNEN: clubs.iban, events.ticket_price, tickets.receipt_url/reviewed_by/
-- reviewed_at, PENDING_PAYMENT/SUBMITTED/REJECTED durumları, RPC
-- ticket_submit_receipt + ticket_approve.
-- KORUNAN (DOKUNULMAZ): tickets tablosu + token + ticket_checkin RPC + rozet
-- trigger'ları + analytics_* + events.ticket_capacity/ticket_deadline +
-- clubs.ticket_enabled + event_attendees (RSVP).
--
-- Storage 'receipts' bucket'ı SQL ile YÖNETİLMİYOR (panelden elle açılmıştı) →
-- Zafer panelden elle siler.

-- 1) Veri normalize (yeni CHECK'i ihlal etmesin) -------------------------------
-- Ödeme akışındaki yarım biletler artık ücretsiz onaylı bilete dönüşür.
update public.tickets
   set status = 'APPROVED'
 where status in ('PENDING_PAYMENT', 'SUBMITTED');
-- Reddedilen biletler ödeme reddiydi; ücretsiz modelde karşılığı yok → temizle.
delete from public.tickets
 where status = 'REJECTED';

-- 2) Durum kümesini daralt: yalnız APPROVED / CHECKED_IN ----------------------
alter table public.tickets drop constraint if exists tickets_status_check;
alter table public.tickets alter column status set default 'APPROVED';
alter table public.tickets
  add constraint tickets_status_check
  check (status in ('APPROVED', 'CHECKED_IN'));

-- 3) Ödeme RPC'lerini kaldır --------------------------------------------------
drop function if exists public.ticket_submit_receipt(uuid, text);
drop function if exists public.ticket_approve(uuid, text, text);

-- 4) Ödeme kolonlarını düşür (kolon-grant'ları ve reviewed_by FK'si otomatik
--    birlikte düşer) -----------------------------------------------------------
alter table public.tickets drop column if exists receipt_url;
alter table public.tickets drop column if exists reviewed_by;
alter table public.tickets drop column if exists reviewed_at;

alter table public.clubs drop column if exists iban;
alter table public.events drop column if exists ticket_price;

-- NOT: ticket_price/iban kolon-seviyesi UPDATE grant'ları (20260617130000)
-- kolon düşünce Postgres tarafından otomatik kaldırılır; ayrı revoke gerekmez.
-- events (ticket_capacity, ticket_deadline) ve clubs (ticket_enabled) grant'ları
-- KORUNUR (bilet kontenjan/son tarih + opt-in anahtarı için).
