// Bilet durumları için ortak etiket/renk meta verisi.

export type TicketStatus =
  | "PENDING_PAYMENT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CHECKED_IN";

export const TICKET_STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT: {
    label: "Ödeme bekliyor",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  SUBMITTED: {
    label: "Onay bekliyor",
    cls: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  },
  APPROVED: {
    label: "Onaylandı",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  REJECTED: {
    label: "Reddedildi",
    cls: "border-red-500/30 bg-red-500/10 text-red-300",
  },
  CHECKED_IN: {
    label: "Giriş yapıldı",
    cls: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  },
};

export function ticketStatusMeta(status: string) {
  return (
    TICKET_STATUS_META[status] ?? {
      label: status,
      cls: "border-white/10 bg-white/5 text-zinc-300",
    }
  );
}

// Bilet tutarını TRY olarak biçimlendirir (numeric string/number toleranslı).
// locale aktif dile göre sayı/sembol biçimini belirler (varsayılan tr-TR).
// Geçersiz/boş tutarda null döner; "ücretsiz" etiketini çağıran taraf çevirir.
export function formatPrice(
  price: number | string | null,
  locale: string = "tr-TR",
): string | null {
  if (price === null) return null;
  const n = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "TRY",
  }).format(n);
}
