-- Yalnızca @metu.edu.tr veya @ncc.metu.edu.tr uzantılı e-postaların
-- auth.users tablosuna eklenmesine izin verir. Diğer tüm kayıtları reddeder.

create or replace function public.enforce_metu_domain()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.email is null
     or not (lower(new.email) like '%@metu.edu.tr'
          or lower(new.email) like '%@ncc.metu.edu.tr') then
    raise exception
      'Sadece @metu.edu.tr veya @ncc.metu.edu.tr uzantili e-postalar ile kayit olunabilir.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_metu_domain on auth.users;
create trigger enforce_metu_domain
  before insert on auth.users
  for each row execute function public.enforce_metu_domain();
