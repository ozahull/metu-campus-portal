"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import {
  BadgeCheck,
  CalendarClock,
  Clock,
  Loader2,
  MapPin,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { knownErrorKey } from "@/lib/known-errors";
import { refreshRoute } from "@/lib/refresh-action";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

// Sınıflandırma SUNUCUDA yapılır ve hazır boolean'larla iner (hydration
// determinizmi — istemci Date.now() ile yeniden hesaplamaz; #418 dersi).
export type TicketCardData = {
  id: string;
  token: string;
  eventId: string;
  eventTitle: string;
  eventDateISO: string;
  location: string | null;
  clubName: string | null;
  /** AKTİF bölüm: APPROVED + etkinlik başlamamış → iptal edilebilir. */
  active: boolean;
  /** Giriş yapılmış (CHECKED_IN) — damga + iptal yok. */
  checkedIn: boolean;
  /** Etkinlik geçti, giriş yapılmadı — damga + iptal yok. */
  expired: boolean;
};

// ticket_cancel RPC'sinin bilinen RAISE metinleri (ticket-flow ile aynı küme).
const CANCEL_ERRORS = [
  ["Giriş yapılmış bilet", "checkedIn"],
  ["Etkinlik başladı", "started"],
] as const;

/**
 * Tek bilet kartı — mobil öncelikli (kapıda, aceleyle): büyük ve kontrastlı QR,
 * büyük dokunma hedefleri. Geçmiş bilette QR soluk + damga (kullanılamaz olduğu
 * görünür) ama SİLİNMEZ — katılım geçmişi olarak kalır. İptal yalnız aktif
 * bilette (ticket_cancel zaten sunucuda da reddeder — UI hizalı, gereksiz
 * hata toast'ı yok).
 */
export function TicketCard({
  ticket,
  locale,
}: {
  ticket: TicketCardData;
  locale: string;
}) {
  const t = useTranslations("tickets");
  const tCancel = useTranslations("events.ticket.cancel");
  const [cancelling, setCancelling] = useState(false);

  async function cancelTicket() {
    setCancelling(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("ticket_cancel", {
      p_ticket_id: ticket.id,
    });
    setCancelling(false);
    if (error) {
      console.error("[tickets] ticket_cancel hatası:", error);
      const known = knownErrorKey(error.message, CANCEL_ERRORS);
      toast.error(known ? tCancel(`errors.${known}`) : tCancel("toastError"));
      return;
    }
    toast.success(tCancel("toastSuccess"));
    // Next 16: router.refresh() açık sayfayı güncellemiyor — liste Server
    // Action refresh ile YERİNDE tazelenir (lib/refresh-action.ts).
    await refreshRoute();
  }

  const stamp = ticket.checkedIn
    ? { label: t("stampCheckedIn"), Icon: BadgeCheck, tone: "success" as const }
    : ticket.expired
      ? { label: t("stampExpired"), Icon: Clock, tone: "muted" as const }
      : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {/* QR — kapıda okutulacak: geniş, beyaz zeminde (tarama kontrastı için
          tema-bağımsız beyaz; ticket-flow'daki bilinçli istisnayla aynı).
          Ekran genişledikçe büyür (w-full + viewBox ölçekleme), min ~200px. */}
      <div className="relative flex justify-center bg-white p-5">
        <div
          className={cn(
            "w-full max-w-64 min-w-52",
            stamp && "opacity-30 grayscale",
          )}
        >
          <QRCodeSVG
            value={ticket.token}
            size={256}
            level="M"
            className="h-auto w-full"
          />
        </div>
        {stamp && (
          <span
            className={cn(
              "absolute top-1/2 left-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 -rotate-6 items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-sm font-bold tracking-wide uppercase shadow-sm",
              stamp.tone === "success"
                ? "border-success/60 bg-success text-success-foreground"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            <stamp.Icon className="size-4" />
            {stamp.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link
          href={`/events/${ticket.eventId}`}
          className="font-display text-lg font-bold tracking-tight text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          <span className="line-clamp-2 break-words">{ticket.eventTitle}</span>
        </Link>

        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <CalendarClock className="size-4 shrink-0 text-primary" />
            {formatDateTime(ticket.eventDateISO, locale, "short")}
          </p>
          {ticket.location && (
            <p className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{ticket.location}</span>
            </p>
          )}
          {ticket.clubName && (
            <p className="flex items-center gap-2">
              <Users className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{ticket.clubName}</span>
            </p>
          )}
        </div>

        <p className="break-all font-mono text-xs tracking-[0.25em] text-muted-foreground">
          {ticket.token}
        </p>

        {/* İptal yalnız AKTİF bilette (sunucu kuralıyla hizalı) — yıkıcı →
            ConfirmDialog; dokunma hedefi h-11 (mobil). */}
        {ticket.active && (
          <div className="mt-auto pt-2">
            <ConfirmDialog
              trigger={
                <Button
                  variant="outline"
                  disabled={cancelling}
                  className="h-11 w-full gap-1.5 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  {cancelling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                  {tCancel("button")}
                </Button>
              }
              title={tCancel("confirmTitle")}
              description={tCancel("confirmBody")}
              confirmLabel={tCancel("confirmLabel")}
              onConfirm={cancelTicket}
            />
          </div>
        )}
      </div>
    </article>
  );
}
