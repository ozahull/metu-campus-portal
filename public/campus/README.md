# Kampüs görselleri

`login-hero.jpg` — auth (giriş/kayıt/şifre) sahnesinin sol panelindeki kampüs
fotoğrafı. Şu an **placeholder** (sıcak gün batımı gradyanı) — gerçek fotoğraf
gelince **yalnızca bu dosyayı** aynı adla değiştir; kod dokunulmaz.

- Yol tek sabitten yönetilir: `HERO_SRC` (`src/components/shared/auth-shell.tsx`).
- Öneri: dikey/portre kadraj, ~1200×1600 veya üzeri, sıcak/akşam tonları
  (üstüne token'lı gün batımı perdesi biniyor, beyaz metin okunur kalır).
- Dosya silinse bile panel bozulmaz: `ImageWithFallback` gradyan perdeye düşer
  (kırık görsel ikonu görünmez).
