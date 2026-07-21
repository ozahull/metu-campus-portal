# =====================================================================
# ODTÜ KKK Portal — Ölçek testi runner (Windows PowerShell)
# =====================================================================
# YEREL / İZOLE Supabase üzerinde sentetik veri üretir, ANALYZE eder ve
# ölçüm sorgularını (EXPLAIN ANALYZE) çalıştırır. CANLI DB'ye ASLA dokunmaz.
#
# Ön koşullar: Docker Desktop açık + `npx supabase start` ile yerel stack ayakta.
# Kullanım:  powershell -ExecutionPolicy Bypass -File scripts/run-scale-test.ps1
# =====================================================================
$ErrorActionPreference = "Stop"
$container = "supabase_db_ncc-campus-app"   # config.toml project_id = ncc-campus-app

Write-Host "==> Docker container kontrolü ($container)..." -ForegroundColor Cyan
$running = docker ps --format '{{.Names}}' | Select-String -SimpleMatch $container
if (-not $running) {
  Write-Host "HATA: '$container' çalışmıyor. Önce 'npx supabase start' çalıştır." -ForegroundColor Red
  exit 1
}

Write-Host "==> 1/3 Sentetik veri yükleniyor (seed-scale-test.sql)..." -ForegroundColor Cyan
Get-Content -Raw scripts/seed-scale-test.sql | docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1

Write-Host "==> 2/3 ANALYZE (planlayıcı istatistikleri)..." -ForegroundColor Cyan
docker exec -i $container psql -U postgres -d postgres -c "analyze;"

Write-Host "==> 3/3 Ölçüm sorguları (EXPLAIN ANALYZE)..." -ForegroundColor Cyan
Get-Content -Raw scripts/measure-scale-test.sql | docker exec -i $container psql -U postgres -d postgres | Tee-Object scripts/measure-output.txt

Write-Host "==> Tamamlandı. Çıktı: scripts/measure-output.txt" -ForegroundColor Green
