-- 20260719140000_club_request_notif_prefs
-- DÜZELTME TURU 1 / Commit 4 — club_request bildirim üreticilerinde tercih kontrolü (Y5).
--
-- Y5: club_request_submit / _resubmit / _decide, notifications'a user_wants_notification
-- kontrolünden GEÇMEDEN doğrudan insert ediyordu. Diğer bildirim üreticileri (on_event_
-- approved, club_announce, event_photos_notify, on_message_sent) tercihe saygılı olduğundan
-- "Sessiz (NONE)" seçen kullanıcıya satır düşmez → webhook tetiklenmez → push gitmez. Ama
-- bu üç RPC körlemesine satır açtığından NONE seçen SUPER_ADMIN/hoca push alıyordu.
--
-- ÇÖZÜM (katman 1 — üretim tarafı): dört bildirim yolunu da tercihe saygılı hale getir.
--   * SUPER_ADMIN'lere giden çoklu insert'e `and user_wants_notification(p.id, null)` ekle.
--   * Başvurana giden tekil insert'leri push_notification helper'ına çevir (o zaten
--     user_wants_notification kontrolü yapar — notifications.sql:127-132).
-- (Katman 2 — fanout tarafı — push-fanout/index.ts'te ayrıca uygulanır.)
--
-- İş mantığı/durum makinesi/yetki DEĞİŞMEDİ; yalnız bildirim yolları tercihe saygılı oldu.
-- İdempotent: create or replace.

-- ============================================================================
-- (a) club_request_submit — SUPER_ADMIN'lere yeni başvuru bildirimi (tercihli).
-- ============================================================================
create or replace function public.club_request_submit(
  p_name text,
  p_description text,
  p_category text,
  p_rationale text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_advisor() then
    raise exception 'Yalnızca hocalar topluluk açma başvurusu yapabilir.';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Topluluk adı gerekli.';
  end if;
  if coalesce(btrim(p_rationale), '') = '' then
    raise exception 'Gerekçe gerekli.';
  end if;

  insert into public.club_requests
    (requested_by, name, description, category, rationale, status)
  values (
    auth.uid(),
    btrim(p_name),
    nullif(btrim(p_description), ''),
    nullif(btrim(p_category), ''),
    btrim(p_rationale),
    'PENDING'
  )
  returning id into v_id;

  -- OKUL yönetimine (tüm SUPER_ADMIN) yeni başvuru bildirimi — TERCİHE SAYGILI (Y5).
  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  select p.id, 'CLUB_REQUEST', btrim(p_name), 'NEW', '/admin', null, null
  from public.profiles p
  where upper(btrim(p.role::text)) = 'SUPER_ADMIN'
    and public.user_wants_notification(p.id, null);

  return v_id;
end;
$$;

-- ============================================================================
-- (b) club_request_resubmit — revizyon sonrası tekrar gönder (tercihli).
-- ============================================================================
create or replace function public.club_request_resubmit(
  p_request_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_rationale text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_owner uuid;
  v_name text;
begin
  select status, requested_by into v_status, v_owner
    from public.club_requests where id = p_request_id;
  if v_owner is null then
    raise exception 'Başvuru bulunamadı.';
  end if;
  if v_owner <> auth.uid() or not public.is_advisor() then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;
  if v_status <> 'CHANGES_REQUESTED' then
    raise exception 'Başvuru revizyon durumunda değil.';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Topluluk adı gerekli.';
  end if;
  if coalesce(btrim(p_rationale), '') = '' then
    raise exception 'Gerekçe gerekli.';
  end if;

  update public.club_requests
    set name = btrim(p_name),
        description = nullif(btrim(p_description), ''),
        category = nullif(btrim(p_category), ''),
        rationale = btrim(p_rationale),
        status = 'PENDING',
        review_note = null,
        updated_at = now()
    where id = p_request_id
    returning name into v_name;

  -- OKUL yönetimine tekrar başvuru bildirimi — TERCİHE SAYGILI (Y5).
  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  select p.id, 'CLUB_REQUEST', v_name, 'NEW', '/admin', null, null
  from public.profiles p
  where upper(btrim(p.role::text)) = 'SUPER_ADMIN'
    and public.user_wants_notification(p.id, null);

  return 'PENDING';
end;
$$;

-- ============================================================================
-- (c) club_request_decide — okul kararı; başvurana bildirim (tercihli, push_notification).
-- ============================================================================
create or replace function public.club_request_decide(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_requester uuid;
  v_name text;
  v_description text;
  v_category text;
  v_new text;
  v_club_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;

  select status, requested_by, name, description, category
    into v_status, v_requester, v_name, v_description, v_category
    from public.club_requests where id = p_request_id;
  if v_requester is null then
    raise exception 'Başvuru bulunamadı.';
  end if;
  if v_status <> 'PENDING' then
    raise exception 'Başvuru beklemede değil.';
  end if;

  v_new := case p_decision
    when 'approve' then 'APPROVED'
    when 'reject'  then 'REJECTED'
    when 'changes' then 'CHANGES_REQUESTED'
    else null
  end;
  if v_new is null then
    raise exception 'Geçersiz karar.';
  end if;

  if v_new = 'APPROVED' then
    -- GERÇEK kulüp oluştur; başvuran HOCA o kulübün danışmanı olur.
    insert into public.clubs (name, description, category, advisor_id)
    values (v_name, v_description, v_category, v_requester)
    returning id into v_club_id;

    update public.club_requests
      set status = 'APPROVED',
          review_note = p_note,
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          created_club_id = v_club_id,
          updated_at = now()
      where id = p_request_id;

    -- Başvurana onay bildirimi — TERCİHE SAYGILI (Y5; push_notification helper'ı
    -- user_wants_notification kontrolünü içerir). Yeni kulübe linkli.
    perform public.push_notification(
      v_requester, 'CLUB_REQUEST', v_name, 'APPROVED',
      '/clubs/' || v_club_id::text, v_club_id, null
    );
  else
    update public.club_requests
      set status = v_new,
          review_note = p_note,
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          updated_at = now()
      where id = p_request_id;

    -- Başvurana red/revizyon bildirimi — TERCİHE SAYGILI (Y5).
    perform public.push_notification(
      v_requester, 'CLUB_REQUEST', v_name, v_new, '/clubs/new', null, null
    );
  end if;

  return v_new;
end;
$$;

-- Grant'lar zaten mevcut (20260716130000); create or replace onları korur.
