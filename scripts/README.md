# Ölçek Testi Scriptleri (`scripts/`)

Bu klasör, portalın **~10.000 günlük kullanıcı** hedefine ölçeklenip ölçeklenmediğini
ölçmek için tekrarlanabilir bir sentetik-veri + ölçüm düzeneğidir.

> ⚠️ **CANLI VERİTABANINA (`zmnmdcuvdrvgdkdcaxjj`) ASLA UYGULANMAZ.**
> Scriptler `TRUNCATE` ile veri siler; yalnızca **yerel / izole** Supabase üzerinde çalıştır.

## Ortam

**Yerel Supabase (Docker)** — canlıdan tam izole, ücretsiz, gerçek `EXPLAIN ANALYZE`
verir, seed yerel hızda çalışır. Docker Desktop açıkken:

```bash
npx supabase start          # ilk çalıştırma imajları indirir (~birkaç dk)
```

Bu, `supabase/migrations/` altındaki 54 migration'ı temiz bir Postgres 17'ye uygular.

## Dosyalar

| Dosya | Ne yapar |
|---|---|
| `seed-scale-test.sql` | 5.000 kullanıcı · 150 kulüp · 1.000 etkinlik · ~20.000 RSVP · 16.480 bilet · 50.000 bildirim · 100 mesaj kanalı (~6.354 mesaj) · 14.672 üyelik üretir. `session_replication_role=replica` ile trigger/FK kapalı (hızlı, idempotent). |
| `measure-scale-test.sql` | Her A2 sayfasının GERÇEK sorgusunu `authenticated` rolü + jwt claim (RLS aktif) altında `EXPLAIN (ANALYZE, BUFFERS)` ile ölçer (M1–M16). |
| `run-scale-test.ps1` | Yukarıdaki ikisini sırayla + `ANALYZE` çalıştıran runner (Windows). |

## Çalıştırma

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-scale-test.ps1
```

veya elle:

```bash
docker exec -i supabase_db_ncc-campus-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/seed-scale-test.sql
docker exec -i supabase_db_ncc-campus-app psql -U postgres -d postgres -c "analyze;"
docker exec -i supabase_db_ncc-campus-app psql -U postgres -d postgres < scripts/measure-scale-test.sql
```

## Eşzamanlılık testi (A4 — bilet kapasitesi yarışı)

`ticket_issue` FOR UPDATE kilidinin yük altında kapasiteyi koruduğunu doğrular
(pgbench ile 2.400 eşzamanlı istek → kapasite=100'ü ASLA aşmaz). Yöntem raporda:
`docs/olcek-testi-raporu.md` § A4.

> Windows/Git-Bash notu: `docker exec ... -f /tmp/x.sql`'de yol dönüşümünü kapatmak
> için komutu `MSYS_NO_PATHCONV=1` ile çalıştır (aksi halde `/tmp` Windows yoluna çevrilir).

## Sonuç raporu

Tüm bulgular, ölçüm tablosu, öneriler ve "10.000 kullanıcı değerlendirmesi":
**`docs/olcek-testi-raporu.md`**.
