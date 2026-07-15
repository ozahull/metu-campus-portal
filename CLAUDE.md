@AGENTS.md

# ODTÜ KKK Kampüs Topluluk & Etkinlik Portalı — Proje Bağlamı

Bu dosya projenin tam bağlamıdır. Yeni özellik eklerken mevcut mimariye,
isimlendirme düzenine, iki temalı (açık/koyu) semantik token tasarım diline
(marka çapası: METU kırmızısı #841515) ve tip güvenliği standartlarına BİREBİR
uy. HAM/HARDCODED RENK YASAK — yalnızca token'lar (bkz. §8). Her değişiklikten
sonra `npx tsc --noEmit` ile tip kontrolü yap. Arayüz metinleri ve kullanıcıya
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
kayıt olabilir. Tasarım dili: premium, minimal, "Apple/Stripe" estetiğinde;
İKİ TEMA (açık + koyu; sistem tercihini izler, navbar'da Sun/Moon switcher ile
elle değiştirilebilir) ve marka çapası METU kırmızısı (#841515), tümü semantik
token'lar üzerinden (bkz. §8).

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
  - Base UI'da `Menu.GroupLabel`/`DropdownMenuLabel` mutlaka `<Menu.Group>`
    (DropdownMenuGroup) içinde olmalı; grupsuz kullanım "MenuGroupContext is
    missing" runtime crash'i verir. (Bu projede Label düz `<div>`'e alındı.)
  - Base color: slate (globals.css OKLCH değişkenleri slate'e ayarlı)
- **Auth & DB:** Supabase (@supabase/supabase-js + @supabase/ssr)
  - Supabase proje ref: **zmnmdcuvdrvgdkdcaxjj** (URL: https://zmnmdcuvdrvgdkdcaxjj.supabase.co)
- **i18n:** next-intl (cookie tabanlı, diller: tr/en, varsayılan tr). **Path routing YOK**
  — dil URL'den değil `NEXT_LOCALE` cookie'sinden okunur (src/i18n/config.ts,
  request.ts, locale-actions.ts; çeviriler messages/tr.json + messages/en.json).
  Dil switcher navbar'da; server tarafı `getRequestConfig` ile cookie'yi okur.
- **Tema:** next-themes (src/components/theme-provider.tsx → attribute="class",
  defaultTheme="system", enableSystem). Açık tema `:root`, koyu tema `.dark`
  sınıfıyla çözülür; navbar'da Sun/Moon `ThemeSwitcher` (arayüz yenilemesi Faz A).
  Root `<html suppressHydrationWarning>` ile SSR flash'ı önlenir.
- **Toast:** sonner (Toaster `richColors`, `position="top-center"`; temasını
  next-themes'ten (`useTheme`) alır, token'larla renklenir — bkz. ui/sonner.tsx)
- **İkonlar:** lucide-react
- **Deploy:** Vercel (GitHub'a her push otomatik deploy tetikler)
- **Repo:** github.com/ozahull/metu-campus-portal (branch: main)

================================================================
## 3. KLASÖR YAPISI
================================================================

src/
├── app/
│   ├── layout.tsx              # Root layout + <Toaster /> (sonner)
│   ├── page.tsx                # "/" → redirect("/login")
│   ├── globals.css            # Tailwind v4 + iki temalı OKLCH token'lar (:root/.dark)
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
│       ├── layout.tsx                  # <Navbar /> + token'lı sarmalayıcı (bg-background)
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
│   │   ├── auth-shell.tsx              # Auth sayfaları için tema-duyarlı kabuk
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
- Profil satırı signup'ta handle_new_user trigger'ıyla otomatik oluşur; oturum
  hemen açıldıysa yalnızca `profiles.update({ full_name }).eq("id", ...)` yapılır
  (upsert DEĞİL — §5'teki "profiles'a upsert yasak" kuralı)
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

Şema artık tamamen supabase/migrations altında versiyonlu ve idempotenttir
(Faz 0). Temiz bir DB'de sırayla uygulanabilir; üretimde IF NOT EXISTS / DROP
IF EXISTS desenleriyle mevcut yapıyı bozmaz. TS tipleri: src/types/database.ts
(Database) — client.ts, server.ts ve middleware.ts `createXClient<Database>`
ile generic'lenmiştir.

**profiles**
- id (uuid, PK, → auth.users.id)
- full_name (text, nullable)
- email (text, nullable)
- role (ENUM user_role, not null, default 'USER' — değerler: 'USER' | 'SUPER_ADMIN')
  ↑ Production'da ENUM. SQL karşılaştırmalarında role::text kullan.

**clubs**
- id (uuid, PK)
- name (text)
- description (text, nullable)
- advisor_id (uuid, nullable, → profiles.id)   ← Faz 0: akademik danışman
- vision, logo_url, cover_url, category, contact_email, contact_phone,
  whatsapp_url, instagram_url (hepsi text, nullable)   ← Faz 1: zengin alanlar
- requires_advisor_approval (boolean, not null, default true)   ← Faz 2: onay kapısı
  (yalnızca SUPER_ADMIN değiştirir — prevent_advisor_change trigger)

**club_members**
- club_id (→ clubs.id)
- user_id (→ profiles.id)   ← embed için FK profiles'a bakar (Faz 0'da garanti)
- role (text, not null, default 'MEMBER' — CHECK in ('MEMBER','ADMIN'))  ← Faz 0
- created_at (timestamptz, not null, default now())  ← Faz 0
- PK (club_id, user_id) = doğal unique

**events**
- id (uuid, PK)
- club_id (→ clubs.id)
- title (text)
- description (text, nullable)
- event_date (timestamptz)
- location (text, nullable)
- status (text, not null, default 'APPROVED')
  CHECK in ('PENDING_ADVISOR','PENDING_SCHOOL','APPROVED','REJECTED','CHANGES_REQUESTED')
  ← Faz 2: akış AKTİF. Yeni etkinlik event_submit ile PENDING_* başlar; APPROVED
  yalnızca okul kararıyla.
- review_note (text, nullable), reviewed_by (uuid → profiles.id, nullable),
  reviewed_at (timestamptz, nullable)   ← Faz 2: inceleme bilgisi

**event_attendees**
- event_id (→ events.id)
- user_id (→ profiles.id)
- created_at (timestamptz, not null, default now())  ← Faz 0
- PK (event_id, user_id) = doğal unique

YARDIMCI FONKSİYON / TRIGGER'LAR:
- public.is_super_admin() → boolean (SECURITY DEFINER; RLS özyinelemesini önler).
  Tüm admin politikaları bunu kullanır. (role::text ile karşılaştırır — enum.)
- public.is_club_admin(p_club_id uuid) → boolean (Faz 1, SECURITY DEFINER):
  club_members'ta user_id=auth.uid(), club_id eşleşir ve role='ADMIN' mi?
  Kulüp başkanı yetkilendirmesinin temelidir.
- public.is_club_advisor(p_club_id uuid) → boolean (Faz 1.5, SECURITY DEFINER):
  clubs'ta id=p_club_id ve advisor_id=auth.uid() mi? Danışman yetkilendirmesi.
- prevent_unauthorized_club_admin trigger (club_members BEFORE INSERT/UPDATE,
  20260616121000): club_members.role 'ADMIN' olurken/çıkarken yalnızca
  SUPER_ADMIN veya kulübün DANIŞMANI yapabilir. Başkan (is_club_admin) üye
  ekler/çıkarır ama BAŞKA başkan atayamaz ("Başkan atamasını yalnızca danışman
  veya okul yapabilir."). Self-join (role='MEMBER') etkilenmez.
- Faz 2 onay RPC'leri (SECURITY DEFINER; yetki+durum doğrulaması içeride):
  - event_submit(p_event_id) → kulüp admin/danışman/super çağırır; clubs
    requires_advisor_approval + advisor_id'ye göre PENDING_ADVISOR / PENDING_SCHOOL.
  - event_advisor_decision(p_event_id, p_decision, p_note) → danışman/super;
    PENDING_ADVISOR iken approve→PENDING_SCHOOL / reject→REJECTED / changes→CHANGES_REQUESTED.
  - event_school_decision(...) → yalnızca super; PENDING_SCHOOL iken
    approve→APPROVED / reject→REJECTED / changes→CHANGES_REQUESTED.
  (review_note/reviewed_by/reviewed_at yazılır. UI tarafı supabase.rpc ile çağırır.)
- prevent_advisor_change trigger (clubs BEFORE UPDATE, 20260616120200; Faz 2'de
  genişletildi): advisor_id VE requires_advisor_approval değişimi yalnızca
  SUPER_ADMIN'e kapalı tutulur.
  clubs UPDATE politikası kulüp başkanına da açık olduğundan, advisor_id
  değişimi DB düzeyinde yalnızca SUPER_ADMIN'e (veya service_role) kilitlidir.
  Kulüp başkanı diğer clubs alanlarını düzenleyebilir ama advisor_id'ye
  dokunamaz (aksi halde "Danışman atamasını yalnızca okul yönetimi
  değiştirebilir." hatası).
- handle_new_user trigger (auth.users AFTER INSERT) → profiles satırını otomatik
  oluşturur (metadata.full_name + email).
- prevent_role_escalation trigger (profiles BEFORE UPDATE) → normal kullanıcı
  kendi role'ünü değiştiremez; yalnızca SUPER_ADMIN veya service_role.
- enforce_metu_domain trigger (auth.users BEFORE INSERT) → domain kısıtı.

RLS POLİTİKALARI (versiyonlu — 20260615120600_rls_policies.sql):
- profiles: SELECT oturum açmış herkes (üye listesi isimleri için); INSERT/UPDATE
  yalnızca kendi satırı (role değişimi trigger ile bloklu).
  GİZLİLİK (Faz 0 kapanışı, 20260615120700): email kolonu KOLON SEVİYESİNDE
  kısıtlı — `revoke select on profiles from authenticated` + `grant select
  (id, full_name, role)`. Yani hiçbir kullanıcı (kendisi dahil) profiles'tan
  email OKUYAMAZ; isim/rol açıktır. anon profiles'ı hiç okuyamaz. Kullanıcının
  kendi e-postası UI'da auth oturumundan (user.email) alınır, profiles'tan DEĞİL.
  → Yeni sorgu yazarken profiles'tan email SEÇME.
  YAZMA GRANT'I DARALTMASI (20260713190000_tighten_profiles_grants — canlıya
  uygulandı): profiles'a authenticated yazma yetkisi tasarıma geri daraltıldı:
  `grant insert (id, email, full_name)` + `grant update (full_name, email)`.
  id ve role HİÇBİR yazma yolunda yer almaz (kolon dışı bırakma +
  prevent_role_escalation trigger = çift koruma). SELECT'e dokunulmadı.
  ⚠️ KURAL — profiles'a İSTEMCİDEN upsert YASAK: PostgREST `.upsert()` çağrısı
  ON CONFLICT yolunda "DO UPDATE SET id = excluded.id, ..." üretir, bu da id
  kolonunda UPDATE yetkisi ister → "permission denied for table profiles".
  Profil satırı signup'ta handle_new_user trigger'ıyla HER ZAMAN oluştuğu için
  upsert zaten gereksiz. Yalnızca `.update({ full_name }).eq("id", ...)` kullan
  (bilinen yazıcılar: register/page.tsx + profile-form.tsx).
- clubs: SELECT herkes; INSERT/DELETE SUPER_ADMIN; UPDATE
  (is_super_admin() OR is_club_advisor(id) OR is_club_admin(id)) ← Faz 1/1.5.
  advisor_id değişimi prevent_advisor_change ile yalnızca SUPER_ADMIN.
- club_members: SELECT herkes; INSERT kendisi + WITH CHECK role='MEMBER'
  (escalation koruması). Yönetim politikaları (is_super_admin() OR
  is_club_advisor(club_id) OR is_club_admin(club_id)): INSERT/UPDATE/DELETE.
  ANCAK role='ADMIN' (başkan) atama/geri alma prevent_unauthorized_club_admin
  trigger'ıyla yalnızca SUPER_ADMIN + DANIŞMAN'a kilitli. Başkan yalnızca
  MEMBER ekler/çıkarır. (Self-delete korunur.)
- events: SELECT (status='APPROVED' OR is_super_admin() OR is_club_advisor(club_id)
  OR is_club_admin(club_id)) ← Faz 2: yöneticiler kendi bekleyen etkinliklerini
  görür; öğrenci yalnızca APPROVED. INSERT/UPDATE/DELETE RLS (super OR advisor OR
  club_admin). GÜVENLİK (Faz 2): authenticated için events INSERT/UPDATE KOLON
  BAZLI — yalnızca (club_id,title,description,event_date,location) yazılabilir;
  status/review_* DOĞRUDAN yazılamaz. status default 'PENDING_SCHOOL'. Durum
  geçişleri yalnızca RPC'ler (event_submit/advisor/school) üzerinden. anon yazamaz.
- event_attendees: SELECT herkes; INSERT/DELETE kendisi.

NOT: PostgREST embed sorguları (örn. `user_id(id, full_name)`,
`clubs(name)`, `event_attendees(user_id)`) yalnızca ilgili FK'lar
tanımlıysa çalışır. Faz 0 FK migration'ı (20260615120500) club_members.user_id
ve event_attendees.user_id'yi profiles(id)'ye bağlar. FK eksikse server
component'lerde `console.error("[...] ... hatası:")` logu düşer.

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
- Faz 3 zengin sunum: cover_url banner, logo_url, category rozeti, "Vizyonumuz"
  bölümü (vision), iletişim/sosyal linkleri (contact_email/phone, whatsapp_url,
  instagram_url — ikonlu; alan boşsa gösterilmez).
- Büyük başlık (METU kırmızısı textShadow ışıma); sağda canManage (SUPER_ADMIN,
  danışman veya başkan) ise "Yönet" butonu (→ /clubs/[id]/manage) + JoinButton
- "Hakkında" cam efektli kart (tam açıklama)
- 2 sütun grid:
  - "Yaklaşan Etkinlikler": yalnızca APPROVED etkinlikler; her biri için
    tarih/konum + "N Kişi Katılıyor" + RSVPButton. (Etkinlik OLUŞTURMA artık
    burada DEĞİL; yönetim panelinde — eski AddEventDialog kaldırıldı.)
  - "Yönetim & Üyeler": club_members → profiles embed, üye listesi (sayı rozeti)

**/events (Etkinlik Keşfi — Faz 3, öğrenci):**
- Yalnızca status='APPROVED' & event_date>=now, tarihe göre sıralı.
- EventsExplorer (client): başlık araması + kulüp + kategori filtresi (useMemo,
  canlı). Kart: kulüp/kategori, başlık, tarih/konum, "N katılıyor", detay linki.

**/events/[id] (Etkinlik Detay — Faz 3):**
- APPROVED değilse redirect(/events) (RLS de korur). Düzenleyen kulüp linkli,
  tarih/konum, tam açıklama, katılımcı sayısı + RSVPButton.
- AddToCalendar (client, kütüphanesiz): Google Takvim linki + .ics indir
  (Blob; bitiş = başlangıç + 2 saat varsayımı).

**/profile (Profil — Faz 3):**
- ProfileForm (client): full_name güncelle (profiles update) + şifre değiştir
  (auth.updateUser). Kulüplerim (club_members→clubs, BAŞKAN rozeti) +
  Katılacağım Etkinlikler (event_attendees→events, APPROVED & gelecek).
- UserMenu dropdown'una "Profilim" linki eklendi.

**/clubs/[id]/manage (Kulüp Yönetim Paneli — Faz 1/1.5):**
- SERVER-SIDE erişim: SUPER_ADMIN veya kulübün DANIŞMANI veya BAŞKANI (ADMIN);
  değilse redirect(/clubs/[id]).
- 3 bölüm:
  - ClubInfoForm: name/category/description/vision/logo/cover/iletişim/sosyal
    → clubs update.
  - ManageEvents: etkinlik ekle/düzenle/sil + Faz 2 onay akışı. Oluşturma
    event_submit ile PENDING_* yapar (APPROVED değil). Her etkinlikte durum
    rozeti. CHANGES_REQUESTED'te review_note + "Tekrar Gönder". canAdvisorDecide
    (danışman/okul) ise PENDING_ADVISOR etkinliklerinde Onayla/Revizyon/Reddet.
  - ManageMembers: roster; üye çıkar (herkes). MEMBER↔ADMIN (başkan ata/geri al)
    kontrolü YALNIZCA danışman+okul'a görünür (canAssignAdmin prop). Başkan bu
    kontrolü görmez (DB'de trigger de bloklar).

**/admin (Yönetici Paneli — yalnızca SUPER_ADMIN):**
- SERVER-SIDE güvenlik: role::text != 'SUPER_ADMIN' ise redirect("/dashboard")
- NewClubForm: name + description → clubs insert
- AdminAssignments (Faz 1.5): YALNIZCA "Akademik Danışman Ata" (kulüp + kullanıcı
  → clubs.advisor_id update). Başkan atama OKUL'da YOK — başkanı DANIŞMAN belirler
  (manage panelinden). Listeler full_name ile (email OKUNMAZ — kolon-grant).
- AdminApprovals (Faz 2): "Okul Onay Kuyruğu" (tüm kulüplerin PENDING_SCHOOL
  etkinlikleri → event_school_decision: Onayla/Revizyon/Reddet) + "Danışman Onayı
  Ayarı" (her kulüp için requires_advisor_approval aç/kapat — yalnızca okul).

================================================================
## 7. ETKİLEŞİMLİ BİLEŞENLER (Client)
================================================================

- **JoinButton:** club_members insert/delete → toast + router.refresh()
- **RSVPButton:** event_attendees insert/delete; "Katılacağım" (kırmızı border)
  ↔ "Katılıyorsunuz" (yeşil) → toast + router.refresh()
- **NewClubForm:** clubs insert
- **ClubsExplorer:** canlı arama
- **UserMenu:** Avatar + dropdown (isim/e-posta/rol) + "Çıkış Yap" (signOut)
- **ClubInfoForm / ManageEvents / ManageMembers:** kulüp yönetim paneli (Faz 1)
- **AdminAssignments:** /admin kulüp-yöneticisi & danışman atama (native select)

Hepsi: lib/supabase/client.ts kullanır, hata toleranslıdır (toast.error),
loading state'i (Loader2 spinner) gösterir.

================================================================
## 8. TASARIM SİSTEMİ (Design Language) — İKİ TEMA, SEMANTİK TOKEN
================================================================

⛔ TEK KURAL: HARDCODED/HAM RENK YASAK. `bg-zinc-950`, `text-white`,
`#841515`, `bg-[#841515]/10`, `rgba(132,21,21,…)` gibi sabit renk sınıfları
ARTIK KULLANILMAZ. Her renk `src/app/globals.css`'teki semantik OKLCH
token'larından gelir. Böylece aynı bileşen hem açık hem koyu temada doğru
çözülür. (Eski koyu-tema-sabit dil arayüz yenilemesi Faz A→B'de kaldırıldı.)

İKİ TEMA ALTYAPISI:
- next-themes `attribute="class"`: açık tema `:root`, koyu tema `.dark` sınıfı.
  Varsayılan sistem tercihi; navbar'daki Sun/Moon `ThemeSwitcher` ile değişir.
- Marka çapası METU kırmızısı ≈ oklch(0.40 0.14 27). primary açık temada derin
  (0.48), koyu temada parlak (0.56) varyant — her ikisinde beyaz metinle
  WCAG AA+ kontrast. Nötrler serin gri (hue 285, düşük chroma).

SEMANTİK TOKEN'LAR (Tailwind sınıfı → CSS değişkeni; açık/koyu otomatik):
- Zemin/metin:  `bg-background` / `text-foreground`
- Kart:         `bg-card` `text-card-foreground` `border-border`
                (hover için `--card-hover` / `hover:bg-card-hover`)
- Marka:        `bg-primary` `text-primary-foreground` `text-primary`
                `border-primary/30` `bg-primary/10` (opacity ile soluk ton)
- İkincil/pas.: `bg-secondary` `bg-muted` `text-muted-foreground` `bg-accent`
- Durum:        `text-success`/`bg-success` (yeşil), `text-warning` (amber),
                `text-destructive`/`bg-destructive` (kırmızı — hata/sil)
- Girdi/odak:   `border-input` `ring-ring` (`focus-visible:ring-2 ring-ring`)
- Popover:      `bg-popover` `text-popover-foreground` (menü/diyalog/toast)
- Grafik:       `--chart-1..5` (recharts'ta `stroke="var(--primary)"` gibi
                doğrudan CSS değişkeni verilir — bkz. admin-analytics.tsx)
- Radius:       `rounded-lg/xl/2xl` `--radius` (0.75rem) türevleri

DESENLER:
- Kart hover (premium): `transition-colors hover:border-primary/40`
  (+ istenirse `hover:-translate-y-0.5 hover:shadow-lg`). Işıma/gradyan gerekiyorsa
  `bg-[radial-gradient(...,color-mix(in oklab,var(--primary) 12%,transparent),transparent)]`
  gibi token'lı `color-mix` kullan — sabit rgba DEĞİL.
- Tipografi: `tracking-tight`, `text-balance`/`text-pretty`; başlık
  `text-foreground`, gövde `text-muted-foreground`.
- Skeleton (yüklenme): `src/components/shared/skeletons.tsx` ortak iskeletleri
  (`ClubGridSkeleton`, `EventGridSkeleton` — `grid-cols-1 sm:grid-cols-2
  lg:grid-cols-3`) + `ui/skeleton` (`bg-muted animate-pulse`). Server veri
  bekleyen bölümleri `<Suspense fallback={<…Skeleton/>}>` ile sar; route
  `loading.tsx` dosyaları da aynı iskeletleri kullanır.
- Boş durum: `shared/empty-state.tsx` (ikon + başlık + açıklama, `border-dashed`).
- Mobil (arayüz yenilemesi Faz C3): 360px tabanı. Tablolar `overflow-x-auto`
  sarmalı; grid'ler `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`; uzun adlar
  `min-w-0 … truncate`; IBAN/token gibi kırılmaz metinler `font-mono break-all`;
  dokunma hedefleri ≥44px (`h-11`).
- Onay diyaloğu: geri alınamaz aksiyonlar `shared/confirm-dialog.tsx`
  (Base UI AlertDialog) ile sarılır — `window.confirm` KULLANMA.

RESKIN — İKİ TASARIM DİLİ (R0 altyapısı tamam):
- Site iki dile ayrılır (token adları AYNI; yalnız değerler/kapsam değişir):
  • Dil A "Kampüs Enerjisi" (öğrenci/global, varsayılan): sıcak kum zemin
    (:root ~oklch hue 55-88), METU kırmızısı + ember + gold aksanları, koyu tema
    (.dark) sıcak akşam ailesi (mor-gri DEĞİL). Kart dili 16px (`--radius:1rem`).
  • Dil B "Sessiz Verimlilik" (yönetim): beyaz/nötr taş grisi, hairline border,
    kırmızı yalnız aksiyonda. `.surface-admin` KAPSAM SINIFI ile globals.css'te
    zemin/kart/border + nötr aile + `--radius:0.5rem` REMAP edilir; primary,
    durum ve aksan token'ları GLOBAL katmandan miras (iki dilde ortak).
    Koyu karşılığı `.dark .surface-admin`. Desen print remap emsaliyle aynı.
- Kapsam uygulaması: `shared/admin-surface.tsx` (`.surface-admin min-h-svh
  bg-background text-foreground` div) SAYFA KÖKÜNE eklenir — (dashboard) grup
  layout'una DEĞİL (navbar Dil A'da kalır). /admin (AdminSurface + PageShell
  `glow={false}`), /clubs/[id]/manage ve /checkin (kök `<main>`'e sınıf).
- YENİ TOKEN'LAR: `--accent-ember` / `--accent-gold` (Dil A sıcak aksanları;
  `bg-accent-ember`/`text-accent-gold` utility'leri) + `--info`/`--info-foreground`
  (durum). Durum renkleri normalize edildi (success `#15803D`, warning `#B45309`,
  destructive `#B91C1C`, info `#0369A1`); iki dilde ortak, koyu temada okunur
  varyant. Gradyan/gölge uygulamaları (color-mix ile) R1-R2'ye ertelendi.
- TİPOGRAFİ (next/font, self-host): gövde **Figtree** (`--font-sans`, italic +
  latin-ext), display **Gabarito** (`--font-display`, `font-display` utility —
  başlıklara uygulaması R1-R2). Mono `--font-geist-mono` korunur; `tabular-nums`
  çekirdek utility.
- R1 TAMAM (auth sahnesi): `shared/auth-shell.tsx` Dil A imzasına döndü — sol
  panelde kampüs fotoğrafı (`ImageWithFallback` + `priority`, tek sabit `HERO_SRC`
  = `/campus/login-hero.jpg`; placeholder foto var, foto silinse bile gradyan tek
  başına düzgün) + token'lı `color-mix` gün batımı perdesi (primary→ember, altın
  radial parıltı) + hafif Ken Burns (`.animate-kenburns`, yalnız
  `prefers-reduced-motion: no-preference`). Formlar (login/register/forgot/reset):
  Gabarito `font-display` başlıklar, 44px inputlar (`h-11`), pill submit
  (`rounded-full` + hover lift/`color-mix` ışıma), primary/ember aksan linkler.
  Eski iki ham dekor (rgba beyaz radial + `bg-white/10`) `color-mix`/`accent-gold`
  token'a çevrildi. Mobilde üstte ince sıcak gradyan şerit.
- R2 TAMAM (öğrenci çekirdeği): `shared/event-card.tsx` FOTOĞRAF ÖNCELİKLİ karta
  döndü — üstte 16:9 kapak (`ImageWithFallback` + `fallback=null`; kapak yoksa
  gün batımı `color-mix` gradyanı + başlığın filigran ilk harfi, kırık ikon YOK),
  kapak köşesinde `DateBadge` çipi, altında kulüp/kategori + Gabarito başlık
  (`line-clamp-2`) + tarih/konum + katılımcı/RSVP; hover `-translate-y-1` + sıcak
  `color-mix` gölge. `EventCardData`'ya `coverUrl` eklendi. VERİ: `events`'te
  cover alanı YOK → sorgular `clubs(cover_url)` çekip kulübün kapağını etkinlik
  kapağı yapar (upcoming-events, /events, kulüp detayı). Kart artık ÜÇ yerde de
  aynı (kulüp detayı eski satır-liste yerine `EventCard` grid'ine geçti).
  Dashboard: StatCard'lar sıcak `color-mix` ikon dairesi + Gabarito büyük sayı;
  fuar keşif banner'ı gradyan + filigran "F" + Gabarito 900. /events: pill arama +
  kategori pill chip dizisi (seçili=dolu primary) + Dil A kulüp select.
  /events/[id]: kapak HERO (gradyan overlay + Gabarito başlık) + iki sütun (sol
  açıklama/foto/takvim, sağ YAPIŞKAN katılım kartı: tarih/konum/kontenjan barı
  `color-mix` dolgu/CTA; mobilde CTA hero'nun hemen altında `order`). INPUT FIX
  (Görev 5): `ui/input.tsx` `bg-transparent`→`bg-background` (sıcak token) +
  `globals.css`'e `-webkit-autofill` remap'i (Chrome soğuk mavi autofill zeminini
  token'a bağlar) → login inputları artık sıcak kum. İş mantığı/RLS/route sabit;
  tek veri değişikliği select'e `cover_url` eklemek.
- Sonraki tur: R4 (admin) — Dil B "Sessiz Verimlilik" yüzeyinin ekran redesign'ı.

ARAYÜZ YENİLEME FAZLARI (tamam): A (iki temalı token altyapısı + switcher) →
B (iskelet/navigasyon/tema-duyarlı yeniden tasarım) → C0/C1/C2 (primary
parlaklık + mikro-etkileşim + skeleton + tipografi + metadata + favicon + onay
diyaloğu + tarih helper + next/image) → C3 (mobil 360px + check-in dokunma
hedefleri) → D (bu dokümantasyon).

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

FAZ 0 TAMAMLANDI ve PRODUCTION'A UYGULANDI (2026-06-16):
- 9 migration (enforce_metu_domain + 8 Faz 0) production veritabanına uygulandı.
- Tüm şema supabase/migrations altında versiyonlu + idempotent:
  base_schema, membership_timestamps, club_member_role, club_advisor,
  events_status_check, foreign_keys, rls_policies (20260615120000..120600).
- created_at (club_members + event_attendees), club_members.role,
  clubs.advisor_id, events.status CHECK eklendi.
- Güvenlik: is_super_admin(), prevent_role_escalation, handle_new_user
  trigger'ları; club_members INSERT role='MEMBER' zorlaması; advisor_id ve
  role atamaları yalnızca SUPER_ADMIN.
- FK'ler profiles(id)'ye bağlandı (embed sorguları için).
- src/types/database.ts üretildi; client/server/middleware <Database> ile
  generic'lendi. `npx tsc --noEmit` temiz; öğrenci tarafı (dashboard, /clubs)
  aynen çalışıyor.
- KAPANIŞ (20260615120700): profiles.email kolon-seviyesinde kısıtlandı
  (PII/KVKK). İsim/rol açık; email yalnızca auth oturumundan okunur. Hiçbir
  kullanıcı başkasının (ya da kendisinin) e-postasını profiles'tan çekemez.

FAZ 1 TAMAMLANDI (kod tarafı) — CLUB_ADMIN + topluluk yönetim paneli:
- DB: is_club_admin(club_id); clubs zengin alanları; RLS genişletme (clubs UPDATE,
  events INSERT/UPDATE/DELETE, club_members yönetim politikaları) →
  20260616120000_clubs_rich_fields, 20260616120100_club_admin_rls.
- UI: /clubs/[id]/manage (3 bölüm: bilgi/etkinlik/üye), detayda "Yönet" butonu,
  /admin'de kulüp-yöneticisi + danışman atama formları.
- src/types/database.ts güncellendi (yeni kolonlar + is_club_admin). tsc temiz.
- Kulüp admini SADECE kendi kulübünü yönetir (is_club_admin RLS); başka kulüpte
  /manage → redirect. Global profiles.role hâlâ trigger korumalı.
- ✅ Migration'lar (20260616*) yeni projeye UYGULANDI (bkz. ALTYAPI DURUMU).

FAZ 1.5 TAMAMLANDI (kod tarafı) — Yetki devri (okul → danışman → başkan):
- Model: SUPER_ADMIN yalnızca DANIŞMAN atar; danışman kulübün BAŞKANINI
  (club_members.role='ADMIN') atar/geri alır ve kulübü yönetir; başkan
  kulübü/etkinlikleri/üyeleri yönetir ama BAŞKAN ATAYAMAZ. Kulübün ayrı
  hesabı/maili yok; kimlik gerçek kişiler üzerinden.
- DB (20260616121000): is_club_advisor(); RLS'e danışman eklendi (clubs/events/
  club_members yönetimi); prevent_unauthorized_club_admin trigger ile ADMIN
  ataması SUPER_ADMIN+DANIŞMAN'a kilitli.
- UI: /admin yalnızca danışman atar; manage erişimi danışman+başkan+okul;
  başkan-atama kontrolü yalnızca danışman+okul'a; detayda "Yönet" danışman/başkana.
- ✅ 20260616121000 migration'ı yeni projeye UYGULANDI.

FAZ 2 TAMAMLANDI (kod tarafı) — Etkinlik onay akışı (iki kapı):
- Etkinlik artık otomatik APPROVED değil. Oluşturma → event_submit →
  (requires_advisor_approval && advisor_id) ? PENDING_ADVISOR : PENDING_SCHOOL.
- Danışman PENDING_ADVISOR'da karar verir (→PENDING_SCHOOL/REJECTED/CHANGES);
  okul PENDING_SCHOOL'da karar verir (→APPROVED/REJECTED/CHANGES). CHANGES_REQUESTED
  → başkan düzenleyip "Tekrar Gönder" ile yeniden akışa girer.
- DB (20260616122000): clubs.requires_advisor_approval; events review_note/
  reviewed_by/reviewed_at; events SELECT genişletildi; 3 SECURITY DEFINER RPC.
- UI: ManageEvents (durum rozetleri, danışman kararları, revizyon); /admin okul
  onay kuyruğu + onay ayarı anahtarı. Öğrenci tarafı değişmedi (yalnızca APPROVED).
- src/lib/event-status.ts ortak durum etiket/renkleri. database.ts güncellendi.
- GÜVENLİK SERTLEŞTİRME: events status default 'PENDING_SCHOOL'; authenticated
  yalnızca içerik kolonlarını insert/update edebilir (status/review_* yalnızca
  RPC=owner). Eski AddEventDialog (status:'APPROVED' doğrudan insert) KALDIRILDI;
  oluşturma yalnızca manage panelinden (insert içerik → event_submit).
- ✅ 20260616122000 migration'ı yeni projeye UYGULANDI.

⚠️ ÖNEMLİ — profiles.role ENUM'dur (user_role):
- Production'da profiles.role bir PostgreSQL ENUM tipidir (user_role), text DEĞİL.
- SQL'de metinle karşılaştırırken/işlerken role::text kullan
  (örn. upper(btrim(role::text)) = 'SUPER_ADMIN'). Enum üzerinde btrim/upper/like
  doğrudan çalışmaz. is_super_admin() bu yüzden role::text ile yazıldı.
- TS tarafı: PostgREST enum'u string döndürür; mevcut kod
  profile?.role?.toString().trim().toUpperCase() ile zaten güvenli.
- NOT: base_schema.sql temiz DB'de role'ü 'text' olarak oluşturur (prod'da enum).
  Bu fark karşılaştırmalarda role::text kullanıldığı sürece sorun yaratmaz.

İLERİSİ İÇİN (opsiyonel bakım):
- Tipleri uzaktan yeniden üret (şema değişince):
    npx supabase gen types typescript --project-id zmnmdcuvdrvgdkdcaxjj > src/types/database.ts
- Canlı politika denetimi:
    select * from pg_policies where schemaname='public';

FAZ 3 TAMAMLANDI (kod tarafı) — Öğrenci tarafı: etkinlik keşfi + zengin kulüpler:
- DB DEĞİŞİKLİĞİ YOK. /events (liste + EventsExplorer canlı arama/kulüp/kategori
  filtresi), /events/[id] (detay + RSVP + AddToCalendar Google/.ics),
  /clubs/[id] zenginleştirildi (cover/logo/kategori/vizyon/iletişim/sosyal),
  Navbar "Etkinlikler" → /events aktif, /profile (kulüpler + RSVP'ler + isim/şifre).
- src/lib yok; ortak event-status.ts mevcut. tsc temiz. Öğrenci yalnızca APPROVED.

FAZ 4 TAMAMLANDI — Biletleme (IBAN + dekont + QR check-in; ONLINE ÖDEME YOK):
- DB (20260617120000_ticketing + 20260617130000_ticket_column_grants):
  clubs.iban + clubs.ticket_enabled; events.ticket_price/ticket_capacity/
  ticket_deadline; tickets tablosu (token = upper(encode(extensions.
  gen_random_bytes(5),'hex')) — pgcrypto extensions'ta, aşağıdaki nota bak;
  status PENDING_PAYMENT→SUBMITTED→APPROVED/REJECTED→CHECKED_IN, receipt_url,
  (event_id,user_id) unique). Kolon-grant: authenticated yalnızca (event_id,
  user_id) INSERT + PENDING iken kendi biletini DELETE; status/receipt/review
  yalnızca RPC ile. 3 SECURITY DEFINER RPC: ticket_submit_receipt (dekont
  yükle→SUBMITTED), ticket_approve (başkan/okul onay/red + kapasite kontrolü),
  ticket_checkin (QR/token ile kapıda giriş; başkan/danışman/okul; tek kullanım).
- UI: /events/[id] ticket-flow (öğrenci: talep aç + IBAN gör + dekont yükle),
  manage/manage-tickets (başkan: dekont onay kuyruğu), /clubs/[id]/checkin +
  checkin-scanner (QR/token kapı girişi). src/lib/ticket-status.ts ortak etiketler.

FAZ 5 TAMAMLANDI — Etkinlik belge eki (onay zincirine kanıt/evrak):
- DB (20260617140000_event_documents): event_documents tablosu (event_id,
  uploaded_by, file_url → event-docs bucket, file_name, note). RLS: SELECT
  yükleyen+başkan+danışman+okul; INSERT yalnız başkan/okul kendi adına; DELETE
  yükleyen. Storage 'event-docs' (PRIVATE) insert/select politikaları
  (path: ${event_id}/${uploaded_by}-${ts}.ext; erişim signed URL ile).
- UI: manage/event-documents (başkan belge yükler/siler; onay zinciri görür).

FAZ 6 TAMAMLANDI — Okula raporlama / analitik (yalnız SUPER_ADMIN):
- DB (20260617150000_analytics): 3 SECURITY DEFINER okuma RPC'si (hepsi
  is_super_admin() kapılı, aksi 'Yetkisiz'): analytics_overview (kampüs özeti —
  kulüp/üye/etkinlik/onaylı/bilet/checkin sayıları), analytics_clubs (kulüp
  bazlı performans), analytics_member_growth (aylık üye artışı zaman serisi).
- UI: /admin admin-analytics (özet kartları + kulüp tablosu + büyüme).

i18n TAMAMLANDI — next-intl (cookie tabanlı, tr/en):
- Path routing YOK: dil `NEXT_LOCALE` cookie'sinden okunur (src/i18n/config.ts,
  request.ts, locale-actions.ts). Çeviriler messages/tr.json + messages/en.json.
- Tüm arayüz metni `useTranslations()` / `getTranslations()` t() anahtarlarından.
  Navbar'da dil switcher; server `getRequestConfig` ile cookie'yi okur.

ARAYÜZ YENİLEMESİ TAMAMLANDI (A→D) — iki temalı tasarım sistemi (bkz. §8):
- Faz A: iki temalı OKLCH token altyapısı + next-themes + Sun/Moon switcher.
- Faz B: iskelet/navigasyon/tema-duyarlı yeniden tasarım (hardcoded renk temizliği).
- Faz C0/C1/C2: primary parlaklık ayarı, mikro-etkileşimler, ortak skeleton'lar,
  tipografi, sayfa metadata title'ları + favicon, onay diyaloğu (confirm-dialog),
  ortak tarih helper (src/lib/datetime.ts), next/image geçişi.
- Faz C3: mobil 360px süpürmesi (tablo overflow-x, grid 1/2/3, truncate,
  IBAN/token break-all) + QR check-in dokunma hedefleri ≥44px.
- Faz D: CLAUDE.md bu güncelleme (tasarım sistemi + güncel durum + yol haritası).

KAYIT/GRANT DÜZELTMESİ (20260713190000 + register):
- Canlı DB'de profiles yazma yetkileri tasarıma geri daraltıldı
  (20260713190000_tighten_profiles_grants). register/page.tsx'teki profiles
  `.upsert()` → `.update({ full_name }).eq("id", ...)` yapıldı (upsert id'de
  UPDATE ister → "permission denied"). Kural §5'te: profiles'a upsert yasak.

ALTYAPI DURUMU (2026-07-13 — YENİ Supabase projesi zmnmdcuvdrvgdkdcaxjj):
- 19/19 migration TEMİZ bir projeye sırayla UYGULANDI (npx supabase db push).
  Artık "henüz production'a uygulanmadı" uyarısı YOK — Faz 0..6'nın tüm şeması
  canlıda. (Yukarıdaki Faz 1/1.5/2 blokları buna göre güncellendi.)
- Storage bucket'ları AÇIK (Supabase panelinden elle oluşturuldu, SQL ile değil):
  • club-images (PUBLIC) — kulüp logo/kapak; okuma public, yazma/güncelle/sil
    yalnız başkan/okul (20260617160000_club_images storage politikaları).
  • event-docs (PRIVATE) — etkinlik evrakı; erişim signed URL ile, yazma başkan/okul
    (20260617140000_event_documents storage politikaları).
- ⚠️ pgcrypto Supabase'de "extensions" ŞEMASINDA kurulu, public'te DEĞİL.
  Migration'da/runtime'da pgcrypto fonksiyonları (gen_random_bytes, crypt, digest,
  hmac, gen_salt, pgp_* vb.) "extensions." ile NİTELENMELİ (ör. extensions.
  gen_random_bytes) — aksi halde search_path'te olmadığı için "function ...
  does not exist (42883)" hatası. gen_random_uuid ÇEKİRDEK fonksiyondur,
  nitelenmez/dokunulmaz. (Bkz. 20260617120000_ticketing.sql:20 DEFAULT ifadesi.)

DİKKAT EDİLECEKLER (teknik borç / bekleyenler):
- (ÇÖZÜLDÜ) Kulüp logo/kapak artık Supabase Storage'a (club-images, PUBLIC)
  yükleniyor — keyfi dış link kaldırıldı. Etkinlik evrakı event-docs (PRIVATE).
- lucide'de Instagram ikonu yok; AtSign kullanıldı.
- (ÇÖZÜLDÜ) Navbar "Etkinlikler" artık /events'e bağlı.
- (ÇÖZÜLDÜ) profiles.email gizliliği: kolon-seviyesi grant ile kısıtlandı
  (20260615120700). İsim/rol authenticated'a açık kalır.

================================================================
## 10. ÜRÜN VİZYONU & YOL HARİTASI
================================================================

VİZYON: Kampüs topluluk hayatının TEK merkezi. Öğrenci mobilde yaşar (hedef:
PWA — telefona kurulabilir, push alır). Roller zinciri net:
SUPER_ADMIN (okul yönetimi) → danışman (her kulübün hocası) → başkan → üye.
Instagram/WhatsApp'a karşı konumlanma: etkinlikler akışta kaybolmaz; kampüsün
TAMAMI tek yerden, kronolojik ve filtrelenebilir görülür. Faz 0-6 + biletleme +
belge + analitik + i18n + iki temalı arayüz TAMAM; sırada etkileşim ve erişim.

--- FAZ 7 — BİLDİRİM SİSTEMİ + PWA (sıradaki BÜYÜK faz) ---
Kullanıcı tarafı kurulum adımları (VAPID anahtar üretimi, Supabase pg_cron
etkinleştirme, Edge Function deploy) fazın BAŞINDA listelenecek.
- DB: `notifications` tablosu (user_id, type, title, body, link, read_at) + RLS
  (kendi bildirimini okur/işaretler). Üreticiler SECURITY DEFINER RPC/trigger.
- Navbar: bildirim zili + okunmamış sayacı (badge); açılır liste, tıkla→read_at.
- Bildirim üreticileri:
  • etkinlik onaylandı → kulüp başkanına
  • yeni (APPROVED) etkinlik → kulüp üyelerine
  • etkinlik hatırlatıcısı → RSVP verenlere, 24 saat kala (pg_cron + Edge Function)
  • başkan duyurusu → kulüp üyelerine (serbest metin "Instagram'a post attık" tipi,
    manage panelinden gönderilir)
- Bildirim tercihleri: üye olduğum kulüpler / tümü / sessiz.
- PWA: manifest + service worker + Web Push (VAPID). Telefona kurulabilir, push alır.

--- FAZ 7.5 — WhatsApp DAVETİ (küçük) ---
- clubs.whatsapp_url davet linki, YALNIZCA üye olan öğrenciye "WhatsApp grubuna
  katıl" butonu olarak gösterilir (spam koruması — üye değilse görünmez).
  Katılım isteğini WhatsApp'ın kendi akışı yönetir.

--- FAZ 8 — ETKİLEŞİM PAKETİ ---
- (a) Etkinlik sonrası fotoğraf duvarı: başkan etkinlik bitince 5-10 fotoğraf
  yükler (storage, event bazlı) → kulüp sayfası yaşayan vitrine döner.
- (b) Katılım rozetleri: "İlk etkinliğin", "5 etkinlik", "Kurucu üye" profil
  rozetleri (SIRALAMA TABLOSU YOK — hafif aidiyet, rekabet değil).
- (c) "Takvimim": öğrencinin RSVP'lerinin haftalık zaman çizelgesi + çakışma
  uyarısı; tek dokunuş RSVP.

--- FAZ 9 — DÖNEM BAŞI + OKUL DEĞERİ ---
- (a) Kulüp Fuarı modu: kayıt haftasında ana sayfa keşif moduna geçer, ilgi
  alanı chip'leriyle kulüp önerisi.
- (b) Okul yönetimine dönem sonu PDF raporu: kulüp bazında üye büyümesi, etkinlik
  sayısı, katılım oranları (Faz 6 analitiğinin üstüne) — ürünün OKULA satış argümanı.

BİLİNÇLİ ERTELENENLER (kapsam dışı): uygulama içi mesajlaşma/forum, puan-ödül
ekonomisi, anket modülü.

TEKNİK ÖN KOŞULLAR (faz dışı, sırada): Vercel deploy; Confirm email + gerçek
SMTP (Resend); test hesap temizliği; middleware → proxy geçişi.

================================================================
## 11. ÇALIŞMA KURALLARI (Geliştirme Konvansiyonları)
================================================================

- Server Component'lerde veri çekmede `force-dynamic` kullan (rol/oturum
  bayatlamasın); client'ta mutasyon sonrası `router.refresh()`.
- Button'ı Link olarak kullanırken `buttonVariants()` + `cn()` (asChild YOK).
- Yeni shadcn bileşeni eklerken `next-themes` bağımlılığına dikkat (tema
  altyapısı next-themes üzerinde — bkz. §2/§8).
- Embed sorgularında FK varsayımını yorumla belirt; hata loglaması ekle.
- Gizli anahtarlar .env.local'de; ASLA commit etme (.gitignore'da .env*).
  Vercel'de env değişkenleri Dashboard'dan ayrıca girilmeli:
  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
- Her değişiklik sonrası `npx tsc --noEmit` çalıştır; tip hatası bırakma.
- RENK: yalnızca semantik token'lar (§8) — hardcoded renk / `#841515` /
  `bg-zinc-*` / `text-white` YASAK. Yeni arayüz hem açık hem koyu temada test.
- TARİH/SAAT: her gösterim `src/lib/datetime.ts` `formatDateTime()`'dan geçer
  (liste/kart "short", detay "long") — sayfa içi elle `toLocaleString` YAZMA.
- YIKICI/GERİ ALINAMAZ işlemler (sil, üye çıkar, bilet iptal): mutlaka
  `shared/confirm-dialog.tsx` onay diyaloğuyla sar — `window.confirm` YOK.
- YENİ SAYFA = metadata. Her route bir `title` verir (root layout template
  `%s · <marka>` uygular; sayfa `export const metadata`/`generateMetadata`).
- profiles'a İSTEMCİDEN upsert/insert YASAK — yalnızca `.update({ full_name })`
  (bkz. §5 grant daraltması). id/role/email istemciden yazılmaz.
- Dokunulmazlar: iş mantığı/sorgular/RLS/RPC/route'lar, i18n t() anahtarları,
  Base UI (asChild yok), paket yöneticisi npm.
- Dil Türkçe; arayüz metinleri ve kullanıcıya mesajlar Türkçe (t() üzerinden).
