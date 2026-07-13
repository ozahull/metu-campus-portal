"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Html5Qrcode } from "html5-qrcode";
import {
  BadgeCheck,
  Camera,
  CameraOff,
  Loader2,
  Search,
  User,
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
          toast.error(t("cameraError"));
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

  return (
    <div className="space-y-6">
      {/* Sonuç bandı */}
      {result && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 ${
            result.ok
              ? "border-success/30 bg-success/10"
              : "border-destructive/30 bg-destructive/10"
          }`}
        >
          {result.ok ? (
            <BadgeCheck className="size-6 shrink-0 text-success" />
          ) : (
            <XCircle className="size-6 shrink-0 text-destructive" />
          )}
          <div className="min-w-0">
            {result.ok ? (
              <>
                <p className="font-semibold text-success">
                  {t("checkedInResult", { name: result.name ?? t("resultUser") })}
                </p>
                {result.event && (
                  <p className="truncate text-sm text-success/80">
                    {result.event}
                  </p>
                )}
              </>
            ) : (
              <p className="font-semibold text-destructive">{result.message}</p>
            )}
          </div>
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
              onClick={() => {
                setScanning(false);
              }}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              <CameraOff className="size-4" />
              {t("stop")}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setResult(null);
                setScanning(true);
              }}
              disabled={processing}
              size="sm"
              className="gap-1.5 font-medium"
            >
              {processing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {t("openCamera")}
            </Button>
          )}
        </div>

        {/* Tarayıcının yerleştiği kapsayıcı */}
        <div
          id={READER_ID}
          className={`mx-auto mt-4 max-w-xs overflow-hidden rounded-lg ${
            scanning ? "block" : "hidden"
          }`}
        />
        {!scanning && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("cameraHint")}
          </p>
        )}
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
            className="pl-9"
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
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5"
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
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5 border-success/40 text-success hover:bg-success/10"
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
