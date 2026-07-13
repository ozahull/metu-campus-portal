-- 20260714120100_club_announce
-- Faz 7A-B — Kulüp başkanı/danışman duyurusu → üyelere CLUB_ANNOUNCEMENT
-- bildirimi. Spam koruması: aynı kulüpten son 1 saatte en fazla 3 duyuru.

create or replace function public.club_announce(
  p_club_id uuid,
  p_title text,
  p_body text,
  p_link text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent integer;
  v_count integer;
  v_link text;
begin
  -- Yetki: yalnız başkan / danışman / okul
  if not (
       public.is_super_admin()
       or public.is_club_admin(p_club_id)
       or public.is_club_advisor(p_club_id)
     ) then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;

  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_body), '') = '' then
    raise exception 'Başlık ve mesaj gerekli.';
  end if;

  -- Spam koruması: aynı kulüpten son 1 saatte en fazla 3 duyuru. Tek bir
  -- club_announce çağrısındaki tüm satırlar aynı now() (işlem başı zaman
  -- damgası) ile yazıldığından distinct created_at = distinct duyuru sayısı.
  select count(distinct created_at) into v_recent
  from public.notifications
  where club_id = p_club_id
    and type = 'CLUB_ANNOUNCEMENT'
    and created_at > now() - interval '1 hour';
  if v_recent >= 3 then
    raise exception 'Son bir saatte en fazla 3 duyuru gönderebilirsiniz.';
  end if;

  -- Bağlantı: verilmişse (Instagram post linki gibi) onu kullan; yoksa kulüp
  -- sayfası. (UI: http ile başlıyorsa yeni sekmede açar, aksi halde iç yönlendirme.)
  v_link := coalesce(nullif(btrim(p_link), ''), '/clubs/' || p_club_id::text);

  -- Tüm üyelere (gönderen hariç, tercihe saygı ile) duyuru bildirimi üret.
  insert into public.notifications (user_id, type, title, body, link, club_id, event_id)
  select m.user_id, 'CLUB_ANNOUNCEMENT', btrim(p_title), btrim(p_body), v_link, p_club_id, null
  from public.club_members m
  where m.club_id = p_club_id
    and m.user_id <> auth.uid()
    and public.user_wants_notification(m.user_id, p_club_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.club_announce(uuid, text, text, text) to authenticated;
