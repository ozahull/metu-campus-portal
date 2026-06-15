-- Faz 0 / Adım 1 — Zaman damgaları (ACİL: katılım/üyelik analitiği için).
-- Mevcut satırlar için default now() uygulanır (geçmiş anlar geri gelmez,
-- ancak bundan sonraki tüm kayıtlar zaman damgalı olur).

alter table public.club_members
  add column if not exists created_at timestamptz not null default now();

alter table public.event_attendees
  add column if not exists created_at timestamptz not null default now();
