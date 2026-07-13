// Etkinlik onay durumları için ortak etiket/renk meta verisi.

export type EventStatus =
  | "PENDING_ADVISOR"
  | "PENDING_SCHOOL"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

// cls'ler iki temada da okunur: yarı saydam kenar/zemin her temada çalışır;
// metin açık temada koyu (…-700), koyu temada açık (dark:…-300) varyant kullanır.
export const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING_ADVISOR: {
    label: "Danışman onayında",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  PENDING_SCHOOL: {
    label: "Okul onayında",
    cls: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  APPROVED: {
    label: "Onaylandı",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  REJECTED: {
    label: "Reddedildi",
    cls: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  CHANGES_REQUESTED: {
    label: "Revizyon istendi",
    cls: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
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
