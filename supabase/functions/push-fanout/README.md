# push-fanout — Web Push Fan-out (Aşama 5C)

`notifications` tablosuna düşen her satırı, o kullanıcının kayıtlı tüm
cihazlarına (push_subscriptions) VAPID imzalı Web Push olarak iletir.

Akış: `notifications INSERT → DB Webhook → push-fanout → web push → sw.js`

## Kurulum (Zafer — sırayla, tek seferlik)

### 1. VAPID anahtar çifti üret

```sh
npx web-push generate-vapid-keys
```

Çıktıdaki `Public Key` ve `Private Key` değerlerini not al.

### 2. Supabase secret'larını tanımla

```sh
npx supabase secrets set VAPID_PUBLIC_KEY=<public key>
npx supabase secrets set VAPID_PRIVATE_KEY=<private key>
npx supabase secrets set VAPID_SUBJECT=mailto:<iletisim eposta adresi>
npx supabase secrets set PUSH_WEBHOOK_SECRET=<uzun rastgele dize>
```

`PUSH_WEBHOOK_SECRET` için ör. `openssl rand -hex 32` (veya PowerShell:
`-join ((1..64) | % { '{0:x}' -f (Get-Random -Max 16) })`).

### 3. Frontend env'i (aynı public key)

`.env.local` + Vercel Dashboard → Environment Variables:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
```

### 4. Fonksiyonu deploy et

```sh
npx supabase functions deploy push-fanout --no-verify-jwt
```

(`--no-verify-jwt` şart: webhook JWT taşımaz; yetki kontrolünü fonksiyon
içindeki `x-webhook-secret` başlığı yapar. config.toml'daki
`[functions.push-fanout] verify_jwt = false` da aynı ayarı kalıcılaştırır.)

### 5. DB Webhook'u kur (Dashboard — migration DEĞİL)

Supabase Dashboard → Database → Webhooks → **Create a new hook**:

- **Name:** `push-fanout`
- **Table:** `public.notifications`
- **Events:** yalnızca `INSERT`
- **Type:** Supabase Edge Functions → `push-fanout`
- **HTTP Headers:** `x-webhook-secret` = `<PUSH_WEBHOOK_SECRET değeri>`
- **Timeout:** 5000 ms yeterli (fonksiyon özet dönene kadar bekler)

### 6. Uçtan uca test

1. Tarayıcıda (giriş yapılmış) Profil → Bildirim Tercihleri → push toggle AÇ
   → `push_subscriptions`'a satır düştüğünü doğrula.
2. SQL Editor'de test bildirimi ekle (kendi user id'nle):

```sql
insert into public.notifications (user_id, type, title, body, link)
values ('<auth.users.id>', 'CLUB_ANNOUNCEMENT', 'Push testi', 'Merhaba!', '/notifications');
```

3. Cihaza bildirim düşer → tıkla → `/notifications` açılır.
4. Edge Functions → Logs'ta `{"sent":1,...}` özetini gör.

## Davranış notları

- Tek abonelik hata verirse diğerleri etkilenmez (`Promise.allSettled`).
- `404/410 Gone` dönen (süresi dolmuş) abonelik satırı otomatik SİLİNİR.
- Payload `{ title, body, link }` — `public/sw.js` bu şemayı bekler.
- Kütüphane: `jsr:@negrel/webpush` (saf WebCrypto; npm:web-push Node
  crypto'ya dayandığı için edge runtime'da bilinçli olarak KULLANILMADI).
