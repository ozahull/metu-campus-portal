-- Faz 1 / A2 — clubs zengin alanları (kulüp yönetim paneli için).
-- Hepsi nullable; idempotent (add column if not exists).

alter table public.clubs add column if not exists vision text;
alter table public.clubs add column if not exists logo_url text;
alter table public.clubs add column if not exists cover_url text;
alter table public.clubs add column if not exists category text;
alter table public.clubs add column if not exists contact_email text;
alter table public.clubs add column if not exists contact_phone text;
alter table public.clubs add column if not exists whatsapp_url text;
alter table public.clubs add column if not exists instagram_url text;
