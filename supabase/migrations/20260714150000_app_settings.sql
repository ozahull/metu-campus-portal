-- 20260714150000_app_settings
-- Faz 9A — Kampüs Fuarı modu için tek satırlık key/value config.
-- Herkes okur; yalnız SUPER_ADMIN yazar. Satır migration'da seed edilir, böylece
-- istemci upsert DEĞİL yalnız update(value) yapar (upsert/pk tuzağına düşmeden).

create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('fair_mode_enabled', 'false')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

revoke all on public.app_settings from authenticated;
revoke all on public.app_settings from anon;
grant select on public.app_settings to authenticated;
-- Yalnızca value güncellenebilir; key değiştirilemez. RLS ile yazma super'a kısıtlı.
grant update (value) on public.app_settings to authenticated;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
