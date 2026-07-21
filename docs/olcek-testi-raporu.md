# ODTÜ KKK Portal — Ölçek Testi Raporu

**Tarih:** 2026-07-21 · **Baz commit:** `54b638f` · **Tur:** ölçüm (kod düzeltmesi YOK)

Hedef: portal ODTÜ KKK'ya satılacak, ~**10.000 öğrenci günlük** kullanacak, Supabase
Pro'ya geçilecek. Bu rapor (A) kodun ölçeklenip ölçeklenmediğini ÖLÇER ve (B) hangi
sorunların **para** (plan yükseltme) ile, hangilerinin **kod/şema** değişikliğiyle
çözüleceğini ayırır.

---

## 0. Yönetici Özeti

**Genel karar: Mevcut haliyle 10.000 kullanıcıya HAZIR DEĞİL — ama sorunlar dar ve nokta atışı.**
Mimari sağlam (N+1 yok, `select("*")` yok, kişi araması sunucu tarafında, bilet
kapasitesi yük altında güvenli). Kaldırıcı olan **5 sorun ailesi** var; hepsi
**kod/şema** düzeltmesiyle (birkaç index + sayfalama + 2 sorgu yeniden yazımı) çözülür.
**Supabase Pro bunların HİÇBİRİNİ tek başına çözmez** (§8).

| # | Bulgu | Ölçülen etki | Çözüm |
|---|---|---|---|
| 🔴 1 | Kişi araması `is_public_profile` her adayda `club_members` seq-scan | **292 ms** (M10) | index → **14 ms** (kanıtlandı) |
| 🔴 2 | Mesaj thread'i RLS `can_access_conversation` **satır başına** | **65 ms** / 530 mesaj (M9) | sorgu/RLS yeniden yazımı |
| 🟠 3 | Eksik index'ler: `events(status,event_date)`, `events(club_id)`, `club_members(user_id)`, `event_attendees(user_id)` | seq-scan (M1,M2,M5,M6) | index (8×–25× hızlanma kanıtlandı) |
| 🟠 4 | `.limit(500)` / `.limit(201)` sabit sınırlar → **sessiz veri kaybı** | admin 5000→500, 600 üyeden 100'ü düşer, thread kesilir | sunucu sayfalama |
| 🟡 5 | Client-side arama/filtre tüm veriyi indirir (`/clubs`, `/events`) | 200-satır cap + tarayıcıya tam set | sunucu-tarafı arama/sayfalama |

**Güvenli bulunanlar:** bilet kapasitesi yarışı (yük altında **kesinlikle** kapasiteyi
korur, empirik kanıt §A4), bildirim tablosu index'leri (mükemmel, 0.12–0.17 ms),
sayaç/batch RPC'ler (`event_attendance_counts` 0.44 ms), kişi araması "server-side ILIKE"
tasarımı (uygulama doğru; darboğaz DB index eksikliği).

---

## 1. Ortam Kurulumu

**Seçim: Yerel Supabase (Docker) — canlıdan TAM İZOLE.**

| Seçenek | Neden seçilmedi/seçildi |
|---|---|
| **Yerel Supabase (Docker)** ✅ | Ücretsiz, canlıdan izole, gerçek `EXPLAIN ANALYZE`, seed yerel hızda, PG 17 (canlıyla aynı). **Seçildi.** |
| Yeni ücretsiz proje (MCP) | MCP hesabı farklı bir org (`ozahull...`); ağ üzerinden 50k+ satır seed etmek çok yavaş; ücretsiz katman sınırlı CPU (göreli ölçüm bozulur). |
| Supabase branch | Kalıcı branch **Pro gerektirir** (canlı proje ücretsiz katmanda). |

Docker Desktop başta kapalıydı → başlatıldı; `npx supabase start` 54 migration'ı temiz
bir Postgres 17'ye uyguladı (52 `schema_migrations` satırı, 2 migration idempotent no-op).
Canlı ref `zmnmdcuvdrvgdkdcaxjj` bu makinede **hiç kullanılmadı** — MCP hesabında bile yok.

**Tekrarlanabilirlik:** `scripts/seed-scale-test.sql`, `scripts/measure-scale-test.sql`,
`scripts/run-scale-test.ps1` (bkz. `scripts/README.md`).

---

## 2. Sentetik Veri (A1)

`session_replication_role=replica` ile (trigger + FK kapalı, hızlı bulk; CHECK/NOT NULL/
UNIQUE **açık**). `auth.users`'a dokunulmadı; RLS ölçümünde `auth.uid()` jwt claim ile taklit.

| Tablo | Üretilen | Not |
|---|---:|---|
| profiles | 5.000 | 5 SUPER_ADMIN, 250 ADVISOR, 100 başkan (club_members.ADMIN), kalan USER; gerçekçi TR ad/e-posta/bölüm |
| clubs | 150 | her birine danışman; ~%33 biletli |
| club_members | 14.672 | uzun kuyruk; en büyük 3 kulüp **600/700/800 üye** (500+ hedefi) |
| events | 1.000 | geçmiş+gelecek; ~%90 APPROVED; ~%33 biletli |
| event_attendees | 20.491 | **etkinlik 1 = 500 katılımcı** (stres) |
| tickets | 16.480 | **etkinlik 3 = 450 bilet** (kapı/check-in stresi); ~%20 CHECKED_IN |
| notifications | 50.000 | kullanıcı 1 = 40 (ağır kullanıcı); ~%40 okunmamış |
| conversations | 100 | ADVISOR_PRESIDENT kanalları |
| messages | 6.354 | **kanal 1-3 = 500+ mesaj** (thread stresi) |
| user_badges / event_photos | 1.500 / 500 | roster rozet + foto sorgularını boş bırakmamak için |

**⚠️ "2.000 kulüp üyeliği" hedefinden bilinçli sapma:** 150 kulüp × en az 20 üye + "birkaç
kulüp 500+ üyeli" koşulu 2.000'e matematiksel olarak SIĞMAZ. Gerçekçi uzun-kuyruk (~14.700
üyelik) seçildi ki `/clubs/[id]` "500+ üyeli" ölçüm hedefi karşılansın.

---

## 3. Ölçüm Tablosu (A2 / A5)

Süre = `EXPLAIN (ANALYZE, BUFFERS)` **Execution Time** (DB-tarafı, cache-sıcak), `authenticated`
rolü + gerçek RLS altında. Eşik: **<1s iyi · 1–3s sınırda · >3s kötü** (DB-tarafı; ağ+render hariç).
"Ölçekte" = 10k+ kullanıcı / olgun kampüste beklenen davranış.

| # | Sayfa / sorgu | Süre (seed ölçeği) | Satır | ~Boyut | Değerlendirme | Ölçekte |
|---|---|---:|---:|---|---|---|
| M1 | `/dashboard`,`/events` — events (status+tarih) | 0.32 ms | 200/414 | ~30 KB | ⚠️ **seq scan** (events'te index YOK) | lineer büyür → index şart |
| M2 | `/clubs/[id]` — events by club_id | 0.16 ms | 7 | küçük | ⚠️ seq scan | büyür → index |
| M3a | attendees **embed** (etkinlik 1, 500 katılımcı) | 0.12 ms | 500 | **~25 KB/etkinlik** | ⚠️ aşırı-çekim (yalnız sayı lazım) | payload + 1000-cap riski |
| M3b | (alternatif) aggregate `count(*)` | 0.08 ms | 1 | ~0 | ✅ doğru desen | — |
| M4 | `/clubs/[id]` roster + profiles embed (600 üye) | 0.78 ms | **500/600** | ~50 KB | 🟠 **VERİ KAYBI** (`.limit(500)`) | 100 üye + sayaç + isMember yanlış |
| M5 | club_members by user_id (`/profile`, arama) | 0.50 ms | 4 | küçük | ⚠️ **seq scan** (14.7k) | büyür + M10'u çarpar |
| M6 | event_attendees by user_id (`/profile`) | 0.87 ms | ~0 | küçük | ⚠️ **seq scan** (20k) | büyür (200k'da ~9 ms) |
| M7 | `/notifications` liste (limit 100, 50k tablo) | 0.12 ms | 50/40 | ~15 KB | ✅ **index İYİ** | sağlam |
| M8 | navbar okunmamış sayaç (**her render**) | 0.17 ms | 1 | — | ✅ **kısmi index İYİ** | sağlam |
| M9 | `/messages/[id]` thread (530 mesaj) | **64.9 ms** | 201/530 | ~24 KB | 🔴 **RLS satır-başına** | thread büyüdükçe kötüleşir |
| M10 | navbar **kişi araması** (5000 profil) | **291.7 ms** | 20 | küçük | 🔴 **KRİTİK** (93.779 buffer) | 10k profil/80k üyelikte saniyeler |
| M11 | `/messages` inbox `list_my_conversations` | 13.9 ms | 1 | — | 🟡 sınırda (**navbar'da her render + thread'de ×3**) | büyür |
| M12 | `/admin` profiles (5000 kullanıcı) | 5.8 ms | **500/5000** | ~40 KB | 🟠 **VERİ KAYBI** (`.limit(500)`) | atama dropdown'ları %90 kör |
| M13 | `/admin` analytics_overview RPC | 3.8 ms | 1 | — | ✅ iyi (aggregate) | sınırda-iyi |
| M14 | `/dashboard` event_attendance_counts (8) | 0.44 ms | 8 | — | ✅ **İYİ (batch)** | sağlam |
| M15 | mesaj hız-sınırı `count(*)` (her mesaj) | 0.18 ms* | — | — | ⚠️ `sender_user_id` index yok | yükte büyür (*şu an boş pencere) |
| M16 | `/tickets` kullanıcı biletleri | 0.04 ms | 5 | küçük | ✅ index İYİ | sağlam |

> Not — **navbar HER sayfa render'ında ~6 sorgu** atar (force-dynamic): profiles, club_members
> sayaç, get_profile, notifications(10), okunmamış sayaç, `list_my_conversations`. Yani her
> gezinme M8 + M11(~14 ms) + get_profile paketini öder. Bu, hızdan çok **DB round-trip yükü**dür.

---

## 4. Sorun Listesi (A3 — önem + kök neden)

### 🔴 KRİTİK

**S1. Kişi araması — `is_public_profile` her adayda `club_members` seq-scan (M10: 292 ms).**
`search_public_profiles` (20260719200000) ILIKE ile ~744 aday bulur; her aday için
`is_public_profile(id)` çağrılır, o da `club_members WHERE user_id=?` yapar — **ama
`club_members(user_id)` index'i YOK** → her çağrı 14.672 satırı tarar. 93.779 buffer hit.
Kök neden: eksik index (S3) + ILIKE'da trigram index yok. **Ölçekte felaket** (10k profil ×
80k üyelik → saniyeler). Navbar aramasında her tuşta tetiklenir.

**S2. Mesaj thread'i — RLS `can_access_conversation` satır başına (M9: 65 ms / 530 mesaj).**
`messages_select` politikası `using (can_access_conversation(conversation_id))`
(20260718120000:185). `conversation_id` bir `Var` olduğu için planlayıcı bunu **hoist
edemez → her satır için** çağrılır; her çağrı ~3 alt-sorgu (conversations + 2 rol helper).
530 mesaj ≈ 530×3 ≈ 1.600 SECURITY DEFINER alt-sorgu. Tüm satırlar aynı kanala ait ve cevap
hep aynı olduğu için bu tamamen gereksiz tekrar. Thread uzadıkça lineer kötüleşir.

### 🟠 YÜKSEK

**S3. Eksik index'ler (seq-scan; M1,M2,M5,M6).** `events` tablosunda **PK dışında HİÇ index yok**:
- `events(status, event_date)` — en sıcak sorgu (dashboard+events her yükleme) tüm tabloyu tarar (M1).
- `events(club_id)` — kulüp detayında seq-scan (M2). FK'ler Postgres'te otomatik index'lenmez.
- `club_members(user_id)` — "kulüplerim", `is_public_profile`, `user_wants_notification` (M5; S1'i çarpar).
- `event_attendees(user_id)` — "katılacağım etkinlikler" 20k satır tarar (M6).

Şu an hepsi <1 ms (tablolar küçük), ama **lineer büyür** ve S1'i 292 ms'ye çıkaran çarpandır.

**S4. Sabit `.limit()` sınırları → sessiz VERİ KAYBI (hızdan bağımsız korrektlik hatası).**
- `admin/page.tsx:71` `profiles ... .limit(500)` / 5000 kullanıcı → atama dropdown'ları,
  `nameById` haritası **%90 kör** (M12). Kodda zaten yorumla işaretli.
- `clubs/[id]/page.tsx:128` roster `.limit(500)` → 600 üyeli kulüpte 100 üye + `members.length`
  sayacı + `isMember` öz-kontrolü **yanlış** (500. sıradan sonraki gerçek üye "üye değil" görür) (M4).
- `messages/[id]/page.tsx:88` `.limit(201)` → 500+ mesajlı thread'de en eski ~330 mesaj **kalıcı erişilemez**.
- `manage` roster (`.limit(500)`), check-in (`.limit(1000)`), tickets sayaç (`.limit(1000)` + JS `.length`).

**S5. Sınırsız (`.limit()`'siz) sorgular — PostgREST 1000 satırda SESSİZCE keser.**
`/tickets` (tickets), `/admin` onay kuyrukları (events PENDING_SCHOOL, club_requests), belge
sorguları, dashboard "yaklaşan RSVP" sayımı. Çoğu bugün küçük (status/user ile sınırlı) ama
büyürse sessizce eksik gösterir.

### 🟡 ORTA

**S6. Client-side arama/filtre tüm veriyi indirir.** `/clubs` ve `/events` tüm listeyi `.limit(200)`
ile çekip `useMemo` ile tarayıcıda filtreler (`clubs-collection.tsx`, `events-explorer.tsx`).
200-cap veri kaybı + her tarayıcıya tam set indirimi. Yüzlerce kulüp/binlerce etkinlikte ölçeklenmez.

**S7. `event_attendees(user_id)` embed aşırı-çekimi (M3a).** dashboard/events/kulüp-detay kartları
sadece "ben katılıyor muyum + sayı" için **tüm katılımcı user_id listesini** çeker
(`upcoming-events.tsx:40`, `events/page.tsx:53`, `clubs/[id]/page.tsx:219`, `events/[id]/page.tsx:72`).
Sayı için `event_attendance_counts` RPC zaten var; embed gereksiz. Ayrıca embed PostgREST 1000-cap'e
takılıp fallback sayacı bozar.

**S8. `list_my_conversations` tekrarı (M11: 14 ms) — thread görünümünde ×3, navbar'da her render.**
`messages/[id]/page.tsx` metadata(35) + gövde(63) + navbar(92) aynı RPC'yi 3 kez çağırır.

**S9. Mesaj hız-sınırı `count(*)` — `messages.sender_user_id` index'i yok (M15).** Her mesaj
gönderiminde `count(*) ... where sender_user_id=? and created_at>now()-1dk` çalışır; `messages`
üzerinde yalnız `(conversation_id, created_at)` index'i var. Yoğun mesajlaşmada maliyeti tablo
büyüdükçe artar. (Kapasite/korrektlik değil, salt maliyet.)

---

## 5. Öneri Listesi — kanıtlı etki (UYGULAMA yok, sadece öneri)

Aşağıdaki index'ler **atılabilir test DB'sinde** denendi; before/after ölçüldü (yeniden ölçüm için
`scripts/measure-scale-test.sql`). **Canlıya uygulanmadı.**

### 5.1 Index'ler (migration olarak yazılacak — ayrı tur)

```sql
create index on events(status, event_date);           -- M1
create index on events(club_id);                       -- M2
create index on club_members(user_id);                 -- M5 (+ S1 çarpanını kırar)
create index on event_attendees(user_id);              -- M6
create extension if not exists pg_trgm;                -- extensions şemasında; nitele
create index on profiles using gin (full_name gin_trgm_ops);  -- M10 ILIKE
create index on messages(sender_user_id, created_at);  -- S9 hız-sınırı
```

**Ölçülen before/after (kanıt):**

| Sorgu | Önce | Sonra (index) | Kazanç |
|---|---:|---:|---|
| M5 club_members by user_id | 0.50 ms (seq 14.7k) | 0.060 ms | **8×** |
| M6 event_attendees by user_id | 0.87 ms (seq 20k) | 0.034 ms | **25×** |
| **M10 kişi araması RPC** | **291.7 ms** | **13.8 ms** | **21×** |
| M1/M2 events | seq scan | Index Scan | ölçekte lineer→sabit |

> M10'daki asıl kazanç **`club_members(user_id)`** index'inden gelir (aday başına seq-scan biter);
> `pg_trgm` ILIKE'ı 5000 satırda henüz devreye sokmuyor (planlayıcı seq-scan'i seçiyor, 3 ms) ama
> 10k+ profilde gereklidir.

### 5.2 Sorgu / kod değişiklikleri (index çözmez)

- **S2 (mesaj RLS, 65 ms):** `messages_select`'i satır-başı `can_access_conversation`'dan kurtar.
  Seçenek: erişimi bir kez doğrula (uygulama zaten `can_write_conversation`'ı çağırıyor) ve
  politikayı `conversation_id IN (erişilebilir kanallar)` gibi hoist-edilebilir bir yapıya çevir,
  ya da mesaj çekimini SECURITY DEFINER RPC'ye taşı (erişimi bir kez kontrol et). **En yüksek ROI.**
- **S4 (veri kaybı):** `admin` kullanıcı listesi + roster'lar → sunucu-tarafı sayfalama/arama
  (`.range()` + arama kutusu RPC). `messages` → cursor tabanlı "daha eski" yükleme. Sayaçlar
  `count(exact, head)` veya aggregate ile (roster/tickets `.length` yerine).
- **S6/S7:** `/clubs`,`/events` → sunucu-tarafı arama+sayfalama; `event_attendees(user_id)` embed'lerini
  kaldır, sayı için `event_attendance_counts`, "ben katılıyor muyum" için tek satırlık
  `event_attendees WHERE event_id=? AND user_id=me` sorgusu.
- **S8:** thread görünümünde `list_my_conversations`'ı 1 kez çağır (metadata ile gövde paylaşsın).

---

## 6. Eşzamanlılık (A4)

### 6.1 Bilet kapasitesi yarışı — ✅ **GÜVENLİ (empirik kanıt)**

`ticket_issue` (canlı sürüm: 20260719240000) ilk ifade olarak etkinlik satırını
`SELECT ... FOR UPDATE` ile **kilitler**; tüm sayım + insert bu kilit altında olur → count↔insert
atomik. `unique(event_id,user_id)` yalnız **aynı kullanıcının** çift biletini önler; kapasiteyi
koruyan şey FOR UPDATE serileştirmesidir.

**Yük testi (pgbench, yerel):** kapasite=100 etkinliğe **2.400 eşzamanlı istek (20 paralel istemci,
rastgele gerçek kullanıcılar)** → sonuç: **tam 100 geçerli bilet, 100 farklı kullanıcı, 0 aşım.**
(1.718 tps, 0 başarısız işlem.) Kilit yük altında **kesinlikle tutuyor.**

### 6.2 Bildirim fanout — ✅ verimli (küçük teknik borç)

500 üyeli kulübe duyuru → **tek `INSERT ... SELECT`** (set-based, 20260714120100:51) → 500 satır tek
ifadede. `notifications`'ta **satır-başı trigger YOK** (20260719190000 sayaç trigger'ı değil, count RPC'si
ekler). Push tarafı: her satır bir webhook invocation'ı, cihaz gönderimi `Promise.all` (paralel, seri
değil). Latency düşük; tek teknik borç: 500 satır = 500 ayrı edge invocation + 500 tercih okuması (chatty
ama doğru).

### 6.3 Hız sınırları — 🟡 yumuşak aşım + maliyet

Mesaj & bilet hız sınırları **sürgülü pencere `count(*)`** (sayaç satırı yok, kilit yok). Aynı
kullanıcının eşzamanlı gönderimleri sınırı **hafifçe aşabilir** (anti-spam için kabul edilebilir,
kapasite/korrektlik değil). Mesaj sayımı `sender_user_id` index'siz (S9) → maliyet tablo büyüdükçe artar;
bilet sayımı `tickets_user_idx` ile ucuz.

---

## 7. 10.000 Kullanıcı Değerlendirmesi

**Mevcut haliyle kaldırmaz.** Neden ve öncelik:

**ŞART (aksi halde kullanıcı bunu hisseder):**
1. **S1 kişi araması (292 ms → 14 ms):** navbar aramasında her tuşta; 10k profilde saniyelere çıkar. `club_members(user_id)` + `pg_trgm` index.
2. **S2 mesaj thread'i (65 ms, büyür):** başkan/danışman panelinin çekirdeği. RLS/sorgu yeniden yazımı.
3. **S4 veri kaybı:** admin 5000 kullanıcının 500'ünü görüyor → **atama sistemi bozuk** (danışman/başkan atanamaz). 600 üyeli kulüpte üyeler kaybolur. Bunlar **fonksiyonel hata**, performans değil — 10k'da kesin patlar.
4. **S3 index'ler:** dashboard/events her yüklemede seq-scan; 20k etkinlikte hissedilir.

**İYİLEŞTİRME (ölçeklenir ama daha iyi olur):**
- S6/S7 client-side filtre → sunucu sayfalama (bant genişliği + tarayıcı belleği).
- S8 tekrar eden RPC, S9 hız-sınırı index'i, navbar round-trip azaltımı.

**Zaten sağlam:** bilet kapasitesi (yük kanıtı), bildirim index'leri, batch sayaçlar, bilet sorguları, fanout.

**Kaba efor:** index'ler ~yarım gün (migration + test). S4 sayfalama ~2-3 gün (admin + roster + messages UI). S2 RLS yeniden yazımı ~1 gün. S6/S7 ~2-3 gün. Toplam ~**1-1.5 hafta**, riskli kısım S4 UI sayfalaması.

---

## 8. Supabase Pro Ayrımı — para neyi çözer, neyi çözmez?

> **Okula "Pro alıyoruz, sorun kalmaz" demeden önce:** Pro bu bulguların **hiçbirini tek başına çözmez.**

| Pro'nun ÇÖZDÜĞÜ (para) | Pro'nun ÇÖZMEDİĞİ (kod/şema) |
|---|---|
| **Bağlantı limiti** — ücretsiz ~60 direct / pooler; 10k kullanıcı **connection pooling** (Supavisor/transaction mode) ZORUNLU. Pro + pooler bunu verir. | **Eksik index'ler (S3)** — seq-scan O(n) kalır; Pro CPU'su sabit-çarpan hızlandırır, algoritmayı değiştirmez. 292 ms araması Pro'da belki 150 ms; index'le 14 ms. |
| **Proje uyumadan** (ücretsiz katman 1 hafta inaktifte durur) | **RLS satır-başı maliyet (S2/S1)** — daha hızlı CPU 530 çağrıyı 530 bırakır; sorgu yeniden yazımı gerekir. |
| **Ham CPU/RAM/IOPS** — sabit-çarpan hız + eşzamanlı bağlantı başlığı | **`.limit()` veri kaybı (S4)** — para değil, **korrektlik hatası**; sayfalama kodu gerekir. |
| **PITR/yedek, daha yüksek I/O**, günlük saklama | **Client-side filtre (S6)** — bant genişliği/tarayıcı; sunucu sayfalama gerekir. |
| Daha yüksek Storage/Egress kotası (foto/evrak) | **PostgREST 1000-satır cap (S5)** — plan bağımsız; sayfalama gerekir. |

**Özet:** Pro **kaçınılmaz ve gereklidir** (10k eşzamanlı için bağlantı havuzu + uyumama +
compute başlığı). Ama **darboğazlar algoritmik** (index/RLS/sayfalama) — bunlar kodla çözülür.
Doğru cümle: *"Pro alıyoruz (ölçek için şart) VE §5'teki index+sayfalama düzeltmelerini yapıyoruz
(darboğazlar için şart)."*

---

## Ek: dosyalar

- `scripts/seed-scale-test.sql` — sentetik veri (tekrarlanabilir)
- `scripts/measure-scale-test.sql` — M1–M16 EXPLAIN ANALYZE
- `scripts/run-scale-test.ps1` — runner · `scripts/README.md` — kullanım
- Düzeltmeler **AYRI TUR**'da yapılacaktır (bu tur salt ölçüm).
