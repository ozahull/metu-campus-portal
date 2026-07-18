-- 20260719160000_event_state_preconditions
-- DÜZELTME TURU 2 / Commit 1 — RSVP ve yeniden-gönderim için durum ön-koşulları (Y3 + Y7).
--
-- Y3: event_attendees_insert_self WITH CHECK yalnız `auth.uid() = user_id` bakıyordu →
--   öğrenci event_id'yi bildiği PENDING/REJECTED/CHANGES etkinliğe doğrudan insert ile RSVP
--   yazıp katılımcı sayacını kirletebiliyordu. Etkinlik durumu koşulu eklenir. Cross-table
--   kontrol RLS-içinde-RLS tuzağına düşmemek için SECURITY DEFINER helper'a taşınır
--   (event_documents / club_request belge bug'larının kök nedeni gömülü alt-sorguydu).
--
-- Y7: event_submit hiçbir durum ön-koşulu koymuyordu → APPROVED bir etkinlik doğrudan RPC
--   ile PENDING_*'a çekilip öğrenci görünürlüğünden kalkıyor, yeniden onaylanınca
--   on_event_approved bildirimleri TEKRAR üretiliyordu. Yalnızca meşru kaynak durumlara izin.
--
-- İdempotent: create or replace / drop policy if exists.

-- ============================================================================
-- Y3.1 — event_is_approved(p_event_id): SECURITY DEFINER (RLS-içinde-RLS yok).
-- ============================================================================
create or replace function public.event_is_approved(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.events
    where id = p_event_id and status = 'APPROVED'
  );
$$;

grant execute on function public.event_is_approved(uuid) to authenticated;

-- ============================================================================
-- Y3.2 — RSVP insert yalnız APPROVED etkinliğe (+ kendi adına).
-- ============================================================================
drop policy if exists "event_attendees_insert_self" on public.event_attendees;
create policy "event_attendees_insert_self" on public.event_attendees
  for insert
  with check (
    auth.uid() = user_id
    and public.event_is_approved(event_id)
  );

-- ============================================================================
-- Y7 — event_submit: yalnız meşru kaynak durumlar.
--   Meşru: PENDING_SCHOOL (yeni oluşturulmuş; default'la başlar, henüz akışa girmedi),
--          CHANGES_REQUESTED (revizyon sonrası tekrar), REJECTED (yeniden deneme).
--   YASAK: APPROVED (yeniden gönderim → görünürlük kaybı + tekrar bildirim), PENDING_ADVISOR
--          (zaten danışman kararında; tekrar gönderim anlamsız).
--   İş mantığı (yönlendirme + bildirim) AYNEN korunur; yalnız ön-koşul eklendi.
-- ============================================================================
create or replace function public.event_submit(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_status text;
  v_requires boolean;
  v_advisor uuid;
  v_new text;
begin
  select club_id, status into v_club_id, v_status
    from public.events where id = p_event_id;
  if v_club_id is null then
    raise exception 'Etkinlik bulunamadı.';
  end if;

  if not (
       public.is_super_admin()
       or public.is_club_advisor(v_club_id)
       or public.is_club_admin(v_club_id)
     ) then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;

  -- Durum ön-koşulu (Y7): APPROVED/PENDING_ADVISOR yeniden gönderilemez.
  if v_status not in ('PENDING_SCHOOL', 'CHANGES_REQUESTED', 'REJECTED') then
    raise exception 'Bu etkinlik gönderime uygun durumda değil (yalnızca yeni, reddedilmiş veya revizyon istenen etkinlikler gönderilebilir).';
  end if;

  select requires_advisor_approval, advisor_id
    into v_requires, v_advisor
    from public.clubs where id = v_club_id;

  if v_requires and v_advisor is not null then
    v_new := 'PENDING_ADVISOR';
  else
    v_new := 'PENDING_SCHOOL';
  end if;

  update public.events
    set status = v_new,
        review_note = null,
        reviewed_by = null,
        reviewed_at = null
    where id = p_event_id;

  return v_new;
end;
$$;

grant execute on function public.event_submit(uuid) to authenticated;
