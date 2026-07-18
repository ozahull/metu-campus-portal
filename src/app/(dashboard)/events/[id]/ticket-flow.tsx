"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck, Ban, Loader2, Ticket as TicketIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ticketStatusMeta } from "@/lib/ticket-status";

export type MyTicket = {
  id: string;
  token: string;
  status: string;
};

type TicketFlowProps = {
  eventId: string;
  // Bilet alımının kapandığı an (deadline ya da etkinlik saati).
  closesAtISO: string;
  ticket: MyTicket | null;
};

// Ücretsiz katılım bileti akışı (ödeme yok): "Yerini Ayırt" → ticket_issue RPC
// ile bilet DOĞRUDAN APPROVED doğar → QR + token gösterilir → kapıda check-in.
export function TicketFlow({ eventId, closesAtISO, ticket }: TicketFlowProps) {
  const router = useRouter();
  const t = useTranslations("events.ticket");
  const [loading, setLoading] = useState(false);

  const closed = new Date(closesAtISO).getTime() <= Date.now();

  async function getTicket() {
    setLoading(true);
    const supabase = createClient();
    // Kapasite/deadline kontrolü + APPROVED yazımı RPC içinde (SECURITY DEFINER).
    const { error } = await supabase.rpc("ticket_issue", { p_event: eventId });
    setLoading(false);
    if (error) {
      toast.error(t("toasts.buyError", { message: error.message }));
      return;
    }
    toast.success(t("toasts.buyCreated"));
    router.refresh();
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
          {closed ? (
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
