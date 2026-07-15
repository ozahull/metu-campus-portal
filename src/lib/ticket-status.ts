// Katılım bileti durumları için ortak etiket/renk meta verisi.
// Ödeme kaldırıldı: yalnızca APPROVED (geçerli bilet) + CHECKED_IN kaldı.

export type TicketStatus = "APPROVED" | "CHECKED_IN";

// cls'ler yalnızca semantik durum token'larından (bkz. event-status.ts) —
// iki temada da okunur; ham amber/emerald/violet YOK.
export const TICKET_STATUS_META: Record<string, { label: string; cls: string }> = {
  APPROVED: {
    label: "Onaylandı",
    cls: "border-success/30 bg-success/10 text-success",
  },
  CHECKED_IN: {
    label: "Giriş yapıldı",
    cls: "border-info/30 bg-info/10 text-info",
  },
};

export function ticketStatusMeta(status: string) {
  return (
    TICKET_STATUS_META[status] ?? {
      label: status,
      cls: "border-border bg-muted text-muted-foreground",
    }
  );
}
