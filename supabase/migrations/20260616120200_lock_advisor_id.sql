-- Faz 1 ek güvenlik — advisor_id'yi DB düzeyinde SUPER_ADMIN'e kilitle.
-- clubs UPDATE politikası kulüp başkanına (is_club_admin) açık olduğundan,
-- UI gizlemesi yeterli değil: kulüp admini advisor_id'yi doğrudan
-- değiştirebilirdi. prevent_role_escalation desenini taklit eden bir
-- BEFORE UPDATE trigger ile advisor_id değişikliğini yalnızca SUPER_ADMIN
-- (veya service_role; auth.uid() null) yapabilsin.

create or replace function public.prevent_advisor_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.advisor_id is distinct from old.advisor_id
     and auth.uid() is not null
     and not public.is_super_admin() then
    raise exception 'Danışman atamasını yalnızca okul yönetimi değiştirebilir.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_advisor_change on public.clubs;
create trigger prevent_advisor_change
  before update on public.clubs
  for each row execute function public.prevent_advisor_change();
