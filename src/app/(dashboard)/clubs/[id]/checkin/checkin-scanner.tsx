"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Html5Qrcode } from "html5-qrcode";
import {
  BadgeCheck,
  Camera,
  CameraOff,
  KeyRound,
  Loader2,
  Search,
  User,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ApprovedTicket = {
  token: string;
  full_name: string | null;
  event_title: string;
};

type CheckinResult = {
  ok: boolean;
  message: string;
  name?: string | null;
  event?: string;
};

const READER_ID = "qr-reader";

export function CheckinScanner({ approved }: { approved: ApprovedTicket[] }) {
  const router = useRouter();
  const t = useTranslations("checkin");
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [query, setQuery] = useState("");
  const [manualCode, setManualCode] = useState("");
  // Kamera izni reddedildi / açılamadı: toast yerine sabit hata ekranı.
  const [cameraDenied, setCameraDenied] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Aynı QR'ın art arda okunmasını engelle.
  const processingRef = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return approved.slice(0, 20);
    return approved.filter((t) =>
      (t.full_name ?? "").toLocaleLowerCase("tr").includes(q),
    );
  }, [approved, query]);

  async function doCheckin(token: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("ticket_checkin", {
      p_token: token,
    });

    setProcessing(false);
    processingRef.current = false;

    if (error) {
      // "Bu bilet zaten kullanıldı" / "Bilet geçerli değil" / "Geçersiz bilet"
      setResult({ ok: false, message: error.message });
      toast.error(error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : null;
    setResult({
      ok: true,
      message: t("checkedInMessage"),
      name: row?.full_name ?? null,
      event: row?.event_title,
    });
    toast.success(
      t("successToast", { name: row?.full_name ?? t("successFallback") }),
    );
    router.refresh();
  }

  async function verifyManual() {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    await doCheckin(code);
    setManualCode("");
  }

  async function stopScanner() {
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (inst) {
      try {
        await inst.stop();
        inst.clear();
      } catch {
        // zaten durmuş olabilir
      }
    }
  }

  // Kamera taraması: scanning true olduğunda başlat, kapanınca durdur.
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const inst = new Html5Qrcode(READER_ID);
        scannerRef.current = inst;
        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            void (async () => {
              await stopScanner();
              setScanning(false);
              await doCheckin(decoded.trim().toUpperCase());
            })();
          },
          () => {
            // her karede okunamama — sessiz geç
          },
        );
      } catch (err) {
        if (!cancelled) {
          setScanning(false);
          setCameraDenied(true);
          console.error("[Checkin] kamera hatası:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  function startScan() {
    setResult(null);
    setCameraDenied(false);
    setScanning(true);
  }

  // Büyük, dolu-zeminli sonuç kartı: kapıda 3 metreden okunur. Zemin token'lı
  // (bg-success / bg-destructive), metin foreground token'ı → iki temada kontrast.
  const tone = result?.ok
    ? {
        card: "bg-success text-success-foreground",
        btn: "bg-success-foreground text-success hover:bg-success-foreground/90",
        title: t("resultApprovedTitle"),
      }
    : {
        card: "bg-destructive text-destructive-foreground",
        // Buton zemini iki temada da açık (destructive-foreground) → metin düz
        // token'a sabit; --destructive-text açılmış tonu beyaz üstünde okunmaz.
        btn: "bg-destructive-foreground text-(--destructive) hover:bg-destructive-foreground/90",
        title: t("resultRejectedTitle"),
      };

  return (
    <div className="space-y-6">
      {/* Sonuç kartı — dev + yüksek kontrast (kapıda uzaktan okunur) */}
      {result && (
        <div
          className={`relative overflow-hidden rounded-2xl px-6 py-8 text-center shadow-lg ${tone.card}`}
        >
          <button
            onClick={() => setResult(null)}
            aria-label={t("dismiss")}
            className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="size-5" />
          </button>

          {result.ok ? (
            <BadgeCheck className="mx-auto size-16" strokeWidth={2.25} />
          ) : (
            <XCircle className="mx-auto size-16" strokeWidth={2.25} />
          )}

          <p className="mt-3 text-2xl font-bold tracking-wide uppercase sm:text-3xl">
            {tone.title}
          </p>

          {result.ok ? (
            <>
              <p className="mt-1 text-lg font-semibold sm:text-xl">
                {result.name ?? t("resultUser")}
              </p>
              {result.event && (
                <p className="mt-0.5 truncate text-sm opacity-80">
                  {result.event}
                </p>
              )}
            </>
          ) : (
            <p className="mx-auto mt-1 max-w-sm text-sm opacity-90">
              {result.message}
            </p>
          )}

          <button
            onClick={startScan}
            className={`mt-5 inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-semibold shadow-sm transition-colors ${tone.btn}`}
          >
            <Camera className="size-4" />
            {t("scanNext")}
          </button>
        </div>
      )}

      {/* Kamera */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <Camera className="size-4 text-primary" />
            {t("qrTitle")}
          </p>
          {scanning ? (
            <Button
              onClick={() => setScanning(false)}
              variant="outline"
              className="h-11 gap-1.5 px-4 text-sm"
            >
              <CameraOff className="size-4" />
              {t("stop")}
            </Button>
          ) : (
            !cameraDenied && (
              <Button
                onClick={startScan}
                disabled={processing}
                className="h-11 gap-1.5 px-4 text-sm font-medium"
              >
                {processing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
                {t("openCamera")}
              </Button>
            )
          )}
        </div>

        {/* Tarayıcının yerleştiği kapsayıcı */}
        <div
          id={READER_ID}
          className={`mx-auto mt-4 max-w-xs overflow-hidden rounded-lg ${
            scanning ? "block" : "hidden"
          }`}
        />
        {scanning && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t("qrAlignHint")}
          </p>
        )}

        {/* Kamera izni hatası ekranı */}
        {!scanning && cameraDenied && (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-6 text-center">
            <CameraOff className="size-8 text-destructive" />
            <p className="font-medium text-foreground">{t("cameraDeniedTitle")}</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t("cameraDeniedBody")}
            </p>
            <Button onClick={startScan} className="mt-1 h-11 gap-1.5 px-4 text-sm">
              <Camera className="size-4" />
              {t("retry")}
            </Button>
          </div>
        )}

        {!scanning && !cameraDenied && (
          <p className="mt-3 text-xs text-muted-foreground">{t("cameraHint")}</p>
        )}
      </div>

      {/* Kod ile giriş (elle) */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <KeyRound className="size-4 text-primary" />
          {t("manualTitle")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") void verifyManual();
            }}
            placeholder={t("manualPlaceholder")}
            disabled={processing}
            inputMode="text"
            autoCapitalize="characters"
            className="h-11 min-w-0 flex-1 font-mono tracking-[0.2em] uppercase"
          />
          <Button
            onClick={() => void verifyManual()}
            disabled={processing || manualCode.trim() === ""}
            className="h-11 shrink-0 gap-1.5 px-4 text-sm font-medium"
          >
            {processing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <BadgeCheck className="size-4" />
            )}
            {t("verify")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("manualHint")}</p>
      </div>

      {/* İsimle arama yedeği */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <Search className="size-4 text-primary" />
          {t("findTitle")}
        </p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-11 pl-9"
          />
        </div>

        <ul className="mt-3 space-y-2">
          {filtered.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              {t("noApproved")}
            </li>
          ) : (
            filtered.map((ticket) => (
              <li
                key={ticket.token}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                  <User className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {ticket.full_name ?? t("unnamedUser")}
                  </span>
                </span>
                <Button
                  onClick={() => doCheckin(ticket.token)}
                  disabled={processing}
                  variant="outline"
                  className="h-11 shrink-0 gap-1.5 border-success/40 px-4 text-sm text-success hover:bg-success/10"
                >
                  {processing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="size-4" />
                  )}
                  {t("checkinButton")}
                </Button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
