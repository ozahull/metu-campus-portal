-- Faz 0 / Adım 5 (FK) — PostgREST embed sorgularının çalışması için
-- club_members.user_id ve event_attendees.user_id FK'lerini profiles(id)'ye
-- bağla. Üretimde bu kolonlar auth.users'a (farklı bir kısıt adıyla) bakıyor
-- olabilir; aşağıdaki DO blokları kolon üzerindeki HER FK'yi kaldırıp doğru
-- olanı ekler (idempotent).

-- club_members.user_id → profiles.id
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.club_members'::regclass
      and c.contype = 'f'
      and c.conkey = array[
        (select attnum from pg_attribute
          where attrelid = 'public.club_members'::regclass and attname = 'user_id')
      ]
  loop
    execute format('alter table public.club_members drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.club_members
  add constraint club_members_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- event_attendees.user_id → profiles.id
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.event_attendees'::regclass
      and c.contype = 'f'
      and c.conkey = array[
        (select attnum from pg_attribute
          where attrelid = 'public.event_attendees'::regclass and attname = 'user_id')
      ]
  loop
    execute format('alter table public.event_attendees drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.event_attendees
  add constraint event_attendees_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
