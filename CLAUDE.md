@AGENTS.md

# ODTÜ KKK Kampüs Topluluk & Etkinlik Portalı — Proje Bağlamı

Bu dosya projenin tam bağlamıdır. Yeni özellik eklerken mevcut mimariye,
isimlendirme düzenine, koyu tema + METU kırmızısı (#841515) tasarım diline
ve tip güvenliği standartlarına BİREBİR uy. Her değişiklikten sonra
`npx tsc --noEmit` ile tip kontrolü yap. Arayüz metinleri ve kullanıcıya
gösterilen mesajlar Türkçedir.

================================================================
## 1. PROJE NEDİR? (Vizyon)
================================================================

Orta Doğu Teknik Üniversitesi (ODTÜ / METU) öğrencileri için bir "Kampüs
Topluluk ve Etkinlik Portalı". Amacı:

- Öğrencilerin kampüsteki kulüpleri (toplulukları) keşfetmesi
- Kulüplere üye olması / ayrılması
- Kulüplerin düzenlediği etkinlikleri görmesi
- Etkinliklere katılım bildirmesi (RSVP)
- Yöneticilerin (SUPER_ADMIN) kulüp ve etkinlik oluşturması

Sadece ODTÜ uzantılı e-postalar (@metu.edu.tr ve @ncc.metu.edu.tr) sisteme
kayıt olabilir. Tasarım dili: premium, minimal, "Apple/Stripe" estetiğinde,
tamamen KOYU TEMA (zinc-950 zemin) ve METU kırmızısı (#841515) aksanlar.

================================================================
## 2. TEKNOLOJİ YIĞINI (Tech Stack)
================================================================

- **Framework:** Next.js 16.2.9 (App Router, Turbopack)
- **Dil:** TypeScript (strict)
- **UI:** Tailwind CSS v4 + shadcn/ui
  - ÖNEMLİ: shadcn bu projede "base-nova" preset'i ile kuruldu.
    Bileşenler Radix DEĞİL, **Base UI** (@base-ui/react) tabanlıdır.
  - Bunun pratik sonucu: `<Button asChild>` ÇALIŞMAZ. Bir Link'i buton
    gibi göstermek için `buttonVariants()` + `cn()` kullan:
    `<Link className={cn(buttonVariants({variant,size}), "...")}>`
  - Base color: slate (globals.css OKLCH değişkenleri slate'e ayarlı)
- **Auth & DB:** Supabase (@supabase/supabase-js + @supabase/ssr)
- **Toast:** sonner (theme="dark" sabit, next-themes bağımlılığı kaldırıldı)
- **İkonlar:** lucide-react
- **Deploy:** Vercel (GitHub'a her push otomatik deploy tetikler)
- **Repo:** github.com/qkmgd5yg89-byte/metu-campus-portal (branch: main)

================================================================
## 3. KLASÖR YAPISI
================================================================

src/
├── app/
│   ├── layout.tsx              # Root layout + <Toaster /> (sonner)
│   ├── page.tsx                # "/" → redirect("/login")
│   ├── globals.css            # Tailwind v4 + slate OKLCH temaları
│   │
│   ├── (auth)/                 # Kimlik doğrulama route grubu
│   │   ├── login/page.tsx              # E-posta + şifre girişi
│   │   ├── register/page.tsx           # Ad/Soyad/E-posta/Şifre kayıt
│   │   └── forgot-password/page.tsx    # Şifre sıfırlama maili talebi
│   │
│   ├── auth/                   # (route grubu DEĞİL, gerçek /auth yolu)
│   │   ├── callback/route.ts           # OAuth/OTP code → session + domain kontrolü
│   │   └── reset-password/page.tsx     # Yeni şifre belirleme
│   │
│   └── (dashboard)/            # Giriş gerektiren alan
│       ├── layout.tsx                  # <Navbar /> + koyu tema sarmalayıcı
│       ├── dashboard/
│       │   ├── page.tsx                # Ana ekran (karşılama + vitrin + kulüpler)
│       │   ├── upcoming-events.tsx     # Global etkinlik vitrini (server)
│       │   ├── clubs-grid.tsx          # Kulüp ızgarası (server)
│       │   └── clubs-skeleton.tsx      # Yüklenme skeleton'ı
│       ├── clubs/
│       │   ├── page.tsx                # /clubs keşif sayfası (server)
│       │   ├── clubs-explorer.tsx      # Canlı arama (client)
│       │   └── [id]/
│       │       ├── page.tsx            # Kulüp detay (server)
│       │       ├── join-button.tsx     # Üye ol/ayrıl (client)
│       │       └── add-event-dialog.tsx # Etkinlik ekle modalı (client, admin)
│       └── admin/
│           ├── page.tsx                # SUPER_ADMIN paneli (server, korumalı)
│           └── new-club-form.tsx       # Kulüp ekleme formu (client)
│
├── components/
│   ├── navbar.tsx              # Global üst menü (server, force-dynamic)
│   ├── user-menu.tsx          # Avatar + dropdown + çıkış (client)
│   ├── shared/
│   │   ├── auth-shell.tsx              # Auth sayfaları için koyu kabuk
│   │   ├── club-card.tsx              # Paylaşılan premium kulüp kartı
│   │   └── rsvp-button.tsx           # Etkinlik katıl/ayrıl (client)
│   └── ui/                     # shadcn bileşenleri (Base UI tabanlı)
│       ├── button, card, input, label, textarea, alert
│       ├── dialog, dropdown-menu, avatar, skeleton, sonner
│
├── lib/
│   ├── auth.ts                # ALLOWED_DOMAINS, isAllowedEmail(), METU_RED
│   ├── utils.ts              # cn() helper
│   └── supabase/
│       ├── client.ts                  # createBrowserClient (Client Component'ler)
│       └── server.ts                  # createServerClient + cookies (Server)
│
├── middleware.ts             # Her istekte Supabase oturumunu yeniler
└── types/                    # (şimdilik boş)

supabase/
├── config.toml
└── migrations/
    └── 20260614093818_enforce_metu_domain.sql  # auth.users domain trigger

================================================================
## 4. KİMLİK DOĞRULAMA AKIŞI (Auth)
================================================================

Sistem **E-posta + Şifre** tabanlıdır (daha önce Google OAuth ve Magic
Link denendi, sonra şifre sistemine geçildi — eski akışların kalıntısı
yoktur).

**Kayıt (/register):**
- Ad, Soyad, METU E-posta, Şifre (göz aç/kapa özellikli)
- E-posta @metu.edu.tr veya @ncc.metu.edu.tr ile bitmiyorsa buton pasif
- `supabase.auth.signUp()` → metadata'ya full_name yazılır
- Oturum hemen açıldıysa `profiles` tablosuna upsert (id, email, full_name)
- E-posta onayı açıksa "onay maili gönderildi" bilgisi gösterilir

**Giriş (/login):**
- E-posta + Şifre → `signInWithPassword()`
- "Şifremi Unuttum" linki → /forgot-password
- Başarılı → /dashboard

**Şifre Sıfırlama:**
- /forgot-password → `resetPasswordForEmail()` (redirectTo:
  /auth/callback?next=/auth/reset-password)
- /auth/reset-password → `updateUser({ password })`

**Callback (/auth/callback/route.ts):**
- `exchangeCodeForSession(code)` ile code'u oturuma çevirir
- GÜVENLİK: e-posta izin verilen domainlerden değilse `signOut()` +
  /login?error=invalid_domain
- `next` parametresini (sadece site-içi "/..." yollarına) destekler
  (open-redirect koruması var)

**Domain Kısıtlaması 3 katmanlı:**
1. Frontend: isAllowedEmail() ile buton pasif / uyarı
2. Callback: oturum sonrası domain doğrulama + signOut
3. Veritabanı: enforce_metu_domain trigger (auth.users BEFORE INSERT)

**Oturum altyapısı:**
- middleware.ts her istekte `getUser()` ile oturumu yeniler ve cookie'leri
  istek/yanıt arasında senkronize eder (SSR oturum sürekliliği)
- lib/supabase/server.ts → Server Component'ler için (cookies)
- lib/supabase/client.ts → Client Component'ler için (browser)

================================================================
## 5. VERİTABANI ŞEMASI (Supabase / PostgreSQL)
================================================================

Tablolar (kod bunları varsayar; RLS politikaları ŞART):

**profiles**
- id (uuid, PK, → auth.users.id)
- full_name (text, nullable)
- email (text)
- role (text, default 'USER' — değerler: 'USER' | 'SUPER_ADMIN')

**clubs**
- id (uuid, PK)
- name (text)
- description (text, nullable)

**club_members**
- club_id (→ clubs.id)
- user_id (→ profiles.id)   ← ÖNEMLİ: embed için FK profiles'a bakmalı
- UNIQUE(club_id, user_id)

**events**
- id (uuid, PK)
- club_id (→ clubs.id)
- title (text)
- description (text, nullable)
- event_date (timestamptz)
- location (text, nullable)
- status (text — 'APPROVED' kullanılıyor)

**event_attendees**
- event_id (→ events.id)
- user_id (→ profiles.id)
- UNIQUE(event_id, user_id)

GEREKLİ RLS POLİTİKALARI (özet):
- profiles: kendi satırını SELECT/INSERT/UPDATE (auth.uid() = id)
- clubs: herkes SELECT; sadece SUPER_ADMIN INSERT
- club_members: herkes SELECT; kendisi INSERT/DELETE (auth.uid()=user_id)
- events: status='APPROVED' SELECT herkes; SUPER_ADMIN INSERT
- event_attendees: herkes SELECT; kendisi INSERT/DELETE

NOT: PostgREST embed sorguları (örn. `user_id(id, full_name)`,
`clubs(name)`, `event_attendees(user_id)`) yalnızca ilgili FK'lar
tanımlıysa çalışır. FK eksikse server component'lerde
`console.error("[...] ... hatası:")` logu düşer.

================================================================
## 6. SAYFA SAYFA NE YAPIYOR?
================================================================

**/ (kök):** Doğrudan /login'e redirect.

**/dashboard (Ana Ekran):**
- "Hoş Geldiniz, [İsim]" + alt açıklama
- ÜSTTE: "Yaklaşan Kampüs Etkinlikleri" vitrini (UpcomingEvents)
  - events tablosundan status=APPROVED & event_date>=now, en yakın 5,
    clubs(name) join + event_attendees(user_id) join
  - Her kart: "düzenleyen: [kulüp]", başlık, tarih (Clock), konum (MapPin),
    "N Kişi Katılıyor" (Flame ikonu) + RSVPButton
- ALTTA: "Aktif Kulüpler" (ClubsGrid, Suspense + skeleton)

**/clubs (Keşif):**
- Başlık "Kampüs Toplulukları" + arama kutusu (Search ikonu)
- ClubsExplorer (client): tüm kulüpler bir kez çekilir, isim/açıklamaya
  göre useMemo ile CANLI filtrelenir
- Paylaşılan ClubCard ile grid; sonuç yoksa "bulunamadı" boş durumu

**/clubs/[id] (Kulüp Detay):**
- Sol üstte "← Geri Dön"
- Büyük başlık (METU kırmızısı textShadow ışıma) + JoinButton (sağda)
- "Hakkında" cam efektli kart (tam açıklama)
- 2 sütun grid:
  - "Yaklaşan Etkinlikler": SUPER_ADMIN ise "+ Etkinlik Ekle" (AddEventDialog);
    her etkinlik için tarih/konum + "N Kişi Katılıyor" + RSVPButton
  - "Yönetim & Üyeler": club_members → profiles embed, üye listesi (sayı rozeti)

**/admin (Yönetici Paneli):**
- SERVER-SIDE güvenlik: profile.role.trim().toUpperCase() !== 'SUPER_ADMIN'
  ise redirect("/dashboard")
- "Yeni Kulüp Ekle" formu (NewClubForm): name + description → clubs insert
  → toast.success + form temizlenir

================================================================
## 7. ETKİLEŞİMLİ BİLEŞENLER (Client)
================================================================

- **JoinButton:** club_members insert/delete → toast + router.refresh()
- **RSVPButton:** event_attendees insert/delete; "Katılacağım" (kırmızı border)
  ↔ "Katılıyorsunuz" (yeşil) → toast + router.refresh()
- **AddEventDialog:** shadcn Dialog (Base UI, kontrollü open state);
  title/description/datetime-local/location + status:'APPROVED' insert
- **NewClubForm:** clubs insert
- **ClubsExplorer:** canlı arama
- **UserMenu:** Avatar + dropdown (isim/e-posta/rol) + "Çıkış Yap" (signOut)

Hepsi: lib/supabase/client.ts kullanır, hata toleranslıdır (toast.error),
loading state'i (Loader2 spinner) gösterir.

================================================================
## 8. TASARIM SİSTEMİ (Design Language)
================================================================

- Zemin: bg-zinc-950 ; kartlar: bg-zinc-900/50 + border-white/5 + backdrop-blur
- METU kırmızısı: #841515 (butonlar, ışımalar, vurgular)
  - Soluk ton: text-[#e7a3a3], bg-[#841515]/10, border-[#841515]/30
- Kart hover efekti (premium):
  `hover:-translate-y-1 hover:border-[#841515]/50
   hover:shadow-[0_8px_30px_-8px_rgba(132,21,21,0.45)]`
- Radial ışıma: `bg-[radial-gradient(50%_60%_at_50%_0%,rgba(132,21,21,0.18),transparent)]`
- Tipografi: tracking-tight, text-balance/text-pretty, beyaz başlık + zinc-400 metin
- Koyu tema, auth/dashboard sayfalarında `dark` sınıfı ile token'lar koyu çözülür

================================================================
## 9. ŞU AN NEREDEYIZ? (Mevcut Durum)
================================================================

MVP TAMAMLANDI ve Vercel'de CANLI:
- Tüm auth akışı (kayıt/giriş/şifre sıfırlama + domain kısıtlaması)
- Onboarding KALDIRILDI (isim artık kayıtta alınıyor)
- Dashboard (vitrin + kulüpler), kulüp keşif + canlı arama
- Kulüp detay (üyeler + etkinlikler)
- Üyelik sistemi (Join/Leave)
- Etkinlik oluşturma (admin) + RSVP sistemi
- Global Navbar + avatar menüsü
- Admin paneli (kulüp ekleme)
- Kök sayfa /login'e yönlendiriyor
- GitHub'a push'lu, Vercel auto-deploy aktif

DİKKAT EDİLECEKLER (teknik borç / bekleyenler):
- Supabase RLS politikalarının ve FK'ların elle kurulması gerekiyor;
  kod bunları varsayıyor. Eksikse embed sorguları ve insert'ler hata verir.
- enforce_metu_domain migration'ı henüz `db push` ile production'a
  uygulanmadı (CLI link + DB şifresi gerekiyordu). Dashboard SQL Editor'dan
  da çalıştırılabilir.
- Navbar'daki "Etkinlikler" linki hâlâ PASİF (henüz /events sayfası yok).
- "Kulübü İncele" dışında kulüp/etkinlik düzenleme-silme UI'ı yok.

================================================================
## 10. SIRADA NE VAR? (Yol Haritası / Gelecek İşler)
================================================================

Önceliklendirilmiş öneriler:

1. **Etkinlikler liste sayfası (/events):** Navbar'daki pasif "Etkinlikler"
   linkini canlandır; tüm yaklaşan etkinlikleri filtrelenebilir listele.
2. **Etkinlik detay sayfası (/events/[id]):** katılımcı listesi, takvime ekle,
   açıklama, konum.
3. **Kulüp/Etkinlik yönetimi (CRUD):** SUPER_ADMIN için düzenleme & silme;
   kulüp başkanı (CLUB_ADMIN) rolü ve yetkilendirme.
4. **Etkinlik onay akışı (status):** şu an her şey 'APPROVED'. PENDING →
   admin onayı → APPROVED iş akışı kur.
5. **Profil sayfası (/profile):** kullanıcının üye olduğu kulüpler ve
   katıldığı etkinlikler; isim/şifre güncelleme.
6. **Bildirimler:** yeni etkinlik / yaklaşan etkinlik hatırlatmaları.
7. **Görseller:** kulüp logoları / etkinlik kapak görselleri (Supabase Storage).
8. **Arama iyileştirme:** kulüp sayısı büyürse Supabase `ilike` ile
   sunucu-taraflı arama + sayfalama.
9. **Production sertleştirme:** enforce_metu_domain migration'ı uygula,
   tüm RLS politikalarını migration olarak versiyonla, types üret
   (`supabase gen types`).

================================================================
## 11. ÇALIŞMA KURALLARI (Geliştirme Konvansiyonları)
================================================================

- Server Component'lerde veri çekmede `force-dynamic` kullan (rol/oturum
  bayatlamasın); client'ta mutasyon sonrası `router.refresh()`.
- Button'ı Link olarak kullanırken `buttonVariants()` + `cn()` (asChild YOK).
- Yeni shadcn bileşeni eklerken `next-themes` bağımlılığına dikkat (sonner'da
  kaldırılmıştı).
- Embed sorgularında FK varsayımını yorumla belirt; hata loglaması ekle.
- Gizli anahtarlar .env.local'de; ASLA commit etme (.gitignore'da .env*).
  Vercel'de env değişkenleri Dashboard'dan ayrıca girilmeli:
  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
- Her değişiklik sonrası `npx tsc --noEmit` çalıştır; tip hatası bırakma.
- Tüm yeni arayüzler koyu tema + #841515 dil ile %100 uyumlu olsun.
- Dil Türkçe; arayüz metinleri ve kullanıcıya mesajlar Türkçe.
