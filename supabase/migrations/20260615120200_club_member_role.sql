-- Faz 0 / Adım 2 — club_members.role (CLUB_ADMIN hazırlığı).
-- Değerler: 'MEMBER' (varsayılan) | 'ADMIN'.
-- Ayrıcalık yükseltme koruması RLS migration'ında (20260615120600):
--   * katılma (INSERT) WITH CHECK ile role = 'MEMBER' zorlanır,
--   * 'ADMIN' ataması yalnızca SUPER_ADMIN'in UPDATE politikasıyla yapılır.

alter table public.club_members
  add column if not exists role text not null default 'MEMBER';

-- CHECK kısıtını idempotent şekilde (yeniden) tanımla.
alter table public.club_members
  drop constraint if exists club_members_role_check;
alter table public.club_members
  add constraint club_members_role_check check (role in ('MEMBER', 'ADMIN'));
