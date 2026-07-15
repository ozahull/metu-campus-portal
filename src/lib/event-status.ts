// Etkinlik onay durumları için ortak etiket/renk meta verisi.

export type EventStatus =
  | "PENDING_ADVISOR"
  | "PENDING_SCHOOL"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

// cls'ler yalnızca semantik durum token'larından — iki temada da okunur (token
// koyu temada açık varyanta kendi döner). Dil B: soluk zemin + koyu/durum metin.
export const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING_ADVISOR: {
    label: "Danışman onayında",
    cls: "border-warning/30 bg-warning/10 text-warning",
  },
  PENDING_SCHOOL: {
    label: "Okul onayında",
    cls: "border-info/30 bg-info/10 text-info",
  },
  APPROVED: {
    label: "Onaylandı",
    cls: "border-success/30 bg-success/10 text-success",
  },
  REJECTED: {
    label: "Reddedildi",
    cls: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  CHANGES_REQUESTED: {
    label: "Revizyon istendi",
    cls: "border-warning/40 bg-warning/15 text-warning",
  },
};

export function statusMeta(status: string) {
  return (
    STATUS_META[status] ?? {
      label: status,
      cls: "border-border bg-muted text-muted-foreground",
    }
  );
}
