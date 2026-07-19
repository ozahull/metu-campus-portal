// Katılım bileti durumları için ortak renk meta verisi. ETİKETLER i18n'den
// gelir (events.ticket.status.* — t() ile); burada yalnız görsel sınıf vardır.
// Ödeme kaldırıldı: yalnızca APPROVED (geçerli bilet) + CHECKED_IN kaldı.

// cls'ler yalnızca semantik durum token'larından (bkz. event-status.ts) —
// iki temada da okunur; ham amber/emerald/violet YOK.
const TICKET_STATUS_META: Record<string, { cls: string }> = {
  APPROVED: { cls: "border-success/30 bg-success/10 text-success" },
  CHECKED_IN: { cls: "border-info/30 bg-info/10 text-info" },
};

export function ticketStatusMeta(status: string) {
  return (
    TICKET_STATUS_META[status] ?? {
      cls: "border-border bg-muted text-muted-foreground",
    }
  );
}
