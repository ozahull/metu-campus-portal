-- Faz 0 / Adım 3 — clubs.advisor_id (akademik danışman bağı).
-- Nullable; yalnızca SUPER_ADMIN set/değiştirebilir (RLS migration'ında
-- clubs UPDATE politikası is_super_admin() ile sınırlandırılır).

alter table public.clubs
  add column if not exists advisor_id uuid;

-- FK'yi idempotent şekilde (yeniden) tanımla.
alter table public.clubs
  drop constraint if exists clubs_advisor_id_fkey;
alter table public.clubs
  add constraint clubs_advisor_id_fkey
  foreign key (advisor_id) references public.profiles (id) on delete set null;
