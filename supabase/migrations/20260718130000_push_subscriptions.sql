-- 20260718130000_push_subscriptions
-- Aşama 5B — Web Push abonelik tablosu. Push, notifications tablosundaki
-- satırı cihaza taşıyan TRANSPORT katmanıdır: notifications INSERT → DB
-- Webhook → push-fanout Edge Function → buradaki aboneliklere VAPID web-push.
-- Üçüncü parti servis YOK; anahtarlar kendi VAPID çiftimiz.
--
-- KURAL (notifications/notification_preferences ile aynı desen): YAZMA yalnızca
-- SECURITY DEFINER RPC (push_subscribe) ile — istemciye INSERT/UPDATE grant'ı
-- verilmez, PostgREST upsert/kolon tuzakları baştan kapalı. Okuma + silme
-- (unsubscribe) kendi satırıyla sınırlı. Edge Function service_role ile okur
-- (RLS bypass) — ek grant gerekmez.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Fan-out sorgusu user_id ile gelir (webhook → o kullanıcının tüm cihazları).
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from authenticated;
revoke all on public.push_subscriptions from anon;
grant select, delete on public.push_subscriptions to authenticated;

-- SELECT/DELETE yalnız kendi satırı. UPDATE yolu hiç yok (grant da politika da).
drop policy if exists push_subs_select on public.push_subscriptions;
create policy push_subs_select on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists push_subs_delete on public.push_subscriptions;
create policy push_subs_delete on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());

-- Kayıt/yeniden bağlama RPC'si. Aynı endpoint başka kullanıcıya kayıtlıysa
-- (ortak kampüs bilgisayarı: eski hesap çıktı, yenisi girip push açtı) satır
-- SON GİREN kullanıcıya bağlanır — eski kullanıcının bildirimi bu cihaza
-- düşmez. İstemciden düz upsert bunu yapamazdı (RLS başkasının satırını
-- göstermez, ON CONFLICT DO NOTHING bayat bağı sessizce korurdu).
create or replace function public.push_subscribe(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadı.';
  end if;
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Geçersiz abonelik.';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = auth.uid(),
        p256dh  = excluded.p256dh,
        auth    = excluded.auth;
end;
$$;

grant execute on function public.push_subscribe(text, text, text) to authenticated;
