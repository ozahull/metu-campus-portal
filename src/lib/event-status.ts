// Etkinlik onay durumları için ortak renk meta verisi. ETİKETLER i18n'den
// gelir (manage.events.status.* — t() ile); burada yalnız görsel sınıf vardır.
// (Eski hardcoded Türkçe label alanları ölüydü — hijyen turunda kaldırıldı.)

// cls'ler yalnızca semantik durum token'larından — iki temada da okunur (token
// koyu temada açık varyanta kendi döner). Dil B: soluk zemin + koyu/durum metin.
const STATUS_META: Record<string, { cls: string }> = {
  PENDING_ADVISOR: { cls: "border-warning/30 bg-warning/10 text-warning" },
  PENDING_SCHOOL: { cls: "border-info/30 bg-info/10 text-info" },
  APPROVED: { cls: "border-success/30 bg-success/10 text-success" },
  REJECTED: {
    cls: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  CHANGES_REQUESTED: { cls: "border-warning/40 bg-warning/15 text-warning" },
};

export function statusMeta(status: string) {
  return STATUS_META[status] ?? { cls: "border-border bg-muted text-muted-foreground" };
}
