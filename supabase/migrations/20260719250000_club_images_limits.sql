-- 20260719250000_club_images_limits
-- GÜVENLİK SERTLEŞTİRME #11 — club-images bucket'ına sunucu-taraflı MIME +
-- boyut sınırı.
--
-- Bucket PUBLIC kalır (kulüp logo/kapak/foto duvarı kamusal — tasarım gereği);
-- bugüne dek MIME/boyut yalnız İSTEMCİDE kontrol ediliyordu (accept +
-- file.type/size) — doğrudan storage API çağrısıyla keyfi içerik (ör. HTML/SVG
-- ile stored-XSS denemesi, dev dosyalar) yüklenebilirdi. Storage, bucket
-- ayarındaki allowed_mime_types / file_size_limit'i SUNUCUDA zorlar.
--
-- 5MB sınırı istemcideki MAX_BYTES (5*1024*1024, event-photo-wall) ile aynı.
-- SVG bilinçli olarak İZİNLİ DEĞİL (script gömülebilir). İdempotent: UPDATE
-- (bucket panelden elle oluşturulmuştu; satır yoksa 0 satır etkiler — aşağıya
-- do-block'lu uyarı kondu ki sessiz geçmesin).

do $$
begin
  update storage.buckets
     set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
         file_size_limit = 5242880  -- 5MB
   where id = 'club-images';
  if not found then
    raise warning 'club-images bucket''ı bulunamadı — limitler uygulanmadı (bucket adını kontrol et).';
  end if;
end
$$;
