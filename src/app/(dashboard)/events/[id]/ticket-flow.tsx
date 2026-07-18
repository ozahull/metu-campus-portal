"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck, Ban, Loader2, Ticket as TicketIcon, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { knownErrorKey } from "@/lib/known-errors";
import { refreshRoute } from "@/lib/refresh-action";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ticketStatusMeta } from "@/lib/ticket-status";

export type MyTicket = {
  id: string;
  token: string;
  status: string;
};

// ticket_issue / ticket_cancel RPC'lerinin bilinen RAISE metinleri (D8):
// ayırt edici mesaj gereken durumlar (kapasite/kapanış vb.); kalanı generic.
const BUY_ERRORS = [
  ["Kapasite dolu", "full"],
  ["Bilet alımı kapandı", "closed"],
  ["katılım bileti kapalı", "disabled"],
  ["Etkinlik yayında değil", "notPublished"],
] as const;
const CANCEL_ERRORS = [
  ["Giriş yapılmış bilet", "checkedIn"],
  ["Etkinlik başladı", "started"],
] as const;

type TicketFlowProps = {
  eventId: string;
  // Zaman kapıları SUNUCUDA hesaplanır (hydration determinizmi — React #418):
  // istemci render'ında Date.now() KULLANMA. Kapı geçse bile RPC yeniden doğrular.
  salesClosed: boolean;
  // Etkinlik başladıysa iptal butonu gösterilmez (RPC de reddeder).
  eventStarted: boolean;
  ticket: MyTicket | null;
};

// Ücretsiz katılım bileti akışı (ödeme yok): "Yerini Ayırt" → ticket_issue RPC
// ile bilet DOĞRUDAN APPROVED doğar → QR + token gösterilir → kapıda check-in.
export function TicketFlow({
  eventId,
  salesClosed,
  eventStarted,
  ticket,
}: TicketFlowProps) {
  const t = useTranslations("events.ticket");
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function getTicket() {
    setLoading(true);
    const supabase = createClient();
    // Kapasite/deadline kontrolü + APPROVED yazımı RPC içinde (SECURITY DEFINER).
    const { error } = await supabase.rpc("ticket_issue", { p_event: eventId });
    setLoading(false);
    if (error) {
      console.error("[ticket-flow] ticket_issue hatası:", error);
      const known = knownErrorKey(error.message, BUY_ERRORS);
      toast.error(known ? t(`errors.${known}`) : t("toasts.buyError"));
      return;
    }
    toast.success(t("toasts.buyCreated"));
    // Next 16: router.refresh() açık sayfayı güncellemiyor — QR/kapasite barı
    // Server Action refresh ile yerinde tazelenir (lib/refresh-action.ts).
    await refreshRoute();
  }

  async function cancelTicket() {
    if (!ticket) return;
    setCancelling(true);
    const supabase = createClient();
    // İptal yetkisi + kapasite iadesi RPC içinde (SECURITY DEFINER).
    const { error } = await supabase.rpc("ticket_cancel", {
      p_ticket_id: ticket.id,
    });
    setCancelling(false);
    if (error) {
      console.error("[ticket-flow] ticket_cancel hatası:", error);
      const known = knownErrorKey(error.message, CANCEL_ERRORS);
      toast.error(known ? t(`cancel.errors.${known}`) : t("cancel.toastError"));
      return;
    }
    toast.success(t("cancel.toastSuccess"));
    await refreshRoute();
  }

  const meta = ticket ? ticketStatusMeta(ticket.status) : null;

  // --- Henüz bilet yok: ücretsiz bilet al ---
  if (!ticket) {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{t("freeLabel")}</p>
            <p className="text-lg font-semibold tracking-tight">{t("free")}</p>
          </div>
          {salesClosed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground">
              <Ban className="size-4" />
              {t("salesClosed")}
            </span>
          ) : (
            <Button
              onClick={getTicket}
              disabled={loading}
              size="lg"
              className="gap-1.5 font-medium"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <TicketIcon className="size-4" />
              )}
              {t("buy")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // --- Bilet var: duruma göre (yalnız APPROVED / CHECKED_IN) ---
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <TicketIcon className="size-4 text-primary" />
          {t("yourTicket")}
        </p>
        {meta && (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
          >
            {t(`status.${ticket.status}`)}
          </span>
        )}
      </div>

      {/* Onaylandı → QR (tarama için beyaz zemin şart; tema-bağımsız). */}
      {ticket.status === "APPROVED" && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG value={ticket.token} size={196} level="M" />
          </div>
          <p className="break-all text-center font-mono text-lg tracking-[0.3em]">
            {ticket.token}
          </p>
          <p className="inline-flex items-center gap-1.5 text-sm text-success">
            <BadgeCheck className="size-4" />
            {t("qrHint")}
          </p>

          {/* İptal (vazgeç) — yalnızca etkinlik başlamadan önce. CHECKED_IN
              bilette bu blok hiç render edilmez (ayrı durum). Yıkıcı → ConfirmDialog. */}
          {!eventStarted && (
            <ConfirmDialog
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cancelling}
                  className="gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  {cancelling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                  {t("cancel.button")}
                </Button>
              }
              title={t("cancel.confirmTitle")}
              description={t("cancel.confirmBody")}
              confirmLabel={t("cancel.confirmLabel")}
              onConfirm={cancelTicket}
            />
          )}
        </div>
      )}

      {/* Check-in yapıldı */}
      {ticket.status === "CHECKED_IN" && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-success">
          <BadgeCheck className="size-4" />
          {t("checkedInNote")}
        </p>
      )}
    </div>
  );
}
