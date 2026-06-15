-- Faz 0 — Temel şema (idempotent).
-- Üretimde tablolar elle oluşturulmuştu; bu migration onları sürüm kontrolüne
-- alır. CREATE TABLE IF NOT EXISTS sayesinde mevcut üretim tablolarına DOKUNMAZ;
-- yalnızca temiz bir veritabanında sıfırdan kurar. Yeni kolonlar/kısıtlar
-- sonraki migration'larda ADD ... IF NOT EXISTS ile eklenir.

-- profiles: auth.users ile birebir kullanıcı profili
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'USER'
);

-- clubs: kampüs toplulukları
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text
);

-- club_members: kulüp üyelikleri (composite PK = doğal unique)
create table if not exists public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (club_id, user_id)
);

-- events: kulüp etkinlikleri
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  title text not null,
  description text,
  event_date timestamptz not null,
  location text,
  status text not null default 'APPROVED'
);

-- event_attendees: etkinlik katılımları (composite PK = doğal unique)
create table if not exists public.event_attendees (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (event_id, user_id)
);

-- Yeni kullanıcı kaydolunca otomatik profil satırı oluştur.
-- full_name'i auth metadata'sından (varsa) al; e-postayı da yaz.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
