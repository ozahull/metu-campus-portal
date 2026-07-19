-- 20260720120000_rate_limit_tunable
-- Mesaj hız sınırı: TANI + SERTLEŞTİRME + DOĞRULANABİLİRLİK (canlı QA bulgusu).
--
-- TANI (kod tarafı): 20260719240000'daki enforce_message_rate_limit MANTIĞI
-- doğrudur. "DEFAULT auth.uid() BEFORE trigger'dan SONRA uygulanır → sender NULL"
-- hipotezi EMPİRİK olarak yanlış: PostgreSQL'de kolon DEFAULT'ları BEFORE INSERT
-- trigger'ından ÖNCE uygulanır (PG17'de doğrulandı), ayrıca messages_insert RLS'i
-- `with check (sender_user_id = auth.uid())` her insert'te GEÇTİĞİNE göre
-- new.sender_user_id insert anında auth.uid()'e eşit ve NULL değildir.
--
-- Bu migration:
--   1) Eşiği app_settings'e taşır (message_rate_per_min, varsayılan 20) → SUPER_ADMIN
--      canlıda 3'e indirip sınırı DOĞRULAYABİLİR, sonra 20'ye geri alır (redeploy yok).
--   2) Sayacı defansif coalesce(new.sender_user_id, auth.uid()) ile besler
--      (mantıken gereksiz ama NULL senaryosuna karşı kemer+askı).
--   3) Trigger'ı yeniden ilan eder (idempotent) → canlıda eksik/pasifse apply sonrası
--      KESİN var ve BEFORE INSERT olur (canlı yokluk senaryosunu da kapatır).
-- RAISE metni AYNEN korunur ki istemci known-errors eşlemesi ("Çok hızlı mesaj")
-- bozulmasın. ticket_issue limiti (5/dk) mantıken doğru ve RPC olduğu için canlıda
-- kesin mevcut — dokunulmadı (bkz. rapor).
--
-- İdempotent: insert ... on conflict do nothing + create or replace + drop trigger if exists.

-- Tunable eşik anahtarı (mevcut app_settings key/value deposunda).
insert into public.app_settings (key, value)
values ('message_rate_per_min', '20')
on conflict (key) do nothing;

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_recent integer;
  -- Defansif: default zaten new.sender_user_id'yi doldurur; yine de NULL gelirse
  -- oturum sahibine düş (sayaç asla "kimliksiz" satırlar üzerinden boşa saymasın).
  v_sender uuid := coalesce(new.sender_user_id, auth.uid());
begin
  -- Eşik app_settings'ten; rakam-dışı/boş/geçersiz değerde 20'ye düşer.
  select nullif(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '')::int
    into v_limit
  from public.app_settings
  where key = 'message_rate_per_min';
  v_limit := coalesce(v_limit, 20);
  if v_limit <= 0 then
    v_limit := 20;
  end if;

  select count(*) into v_recent
  from public.messages
  where sender_user_id = v_sender
    and created_at > now() - interval '1 minute';

  if v_recent >= v_limit then
    raise exception 'Çok hızlı mesaj gönderiyorsunuz. Lütfen kısa bir süre bekleyin.';
  end if;
  return new;
end;
$$;

-- Trigger'ı yeniden ilan et (canlıda yoksa/pasifse apply sonrası KESİN aktif).
drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();
