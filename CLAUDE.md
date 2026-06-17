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
- ⚠️ Bu fazın migration'ları (20260616*) henüz production'a UYGULANMADI —
  `npx supabase db push` ile uygulanmalı (aksi halde yeni kolonlar/politikalar
  canlıda yok; manage paneli RLS/kolon hatası verir).

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
- ⚠️ 20260616121000 migration'ı henüz production'a UYGULANMADI (db push gerek).

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
- ⚠️ 20260616122000 migration'ı henüz production'a UYGULANMADI (db push gerek).

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
    npx supabase gen types typescript --project-id qxhyxxekaukwksupphzv > src/types/database.ts
- Canlı politika denetimi:
    select * from pg_policies where schemaname='public';

FAZ 3 TAMAMLANDI (kod tarafı) — Öğrenci tarafı: etkinlik keşfi + zengin kulüpler:
- DB DEĞİŞİKLİĞİ YOK. /events (liste + EventsExplorer canlı arama/kulüp/kategori
  filtresi), /events/[id] (detay + RSVP + AddToCalendar Google/.ics),
  /clubs/[id] zenginleştirildi (cover/logo/kategori/vizyon/iletişim/sosyal),
  Navbar "Etkinlikler" → /events aktif, /profile (kulüpler + RSVP'ler + isim/şifre).
- src/lib yok; ortak event-status.ts mevcut. tsc temiz. Öğrenci yalnızca APPROVED.

DİKKAT EDİLECEKLER (teknik borç / bekleyenler):
- Görseller URL ile (logo/cover) — Supabase Storage yükleme UI'ı yok (ileride).
- lucide'de Instagram ikonu yok; AtSign kullanıldı.
- (ÇÖZÜLDÜ) Navbar "Etkinlikler" artık /events'e bağlı.
- (ÇÖZÜLDÜ) profiles.email gizliliği: kolon-seviyesi grant ile kısıtlandı
  (20260615120700). İsim/rol authenticated'a açık kalır.

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
