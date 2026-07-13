// Ortak tarih/saat biçimlendirme — TÜM gösterimler buradan geçer ki sayfa
// sayfa format farkı olmasın. Aktif locale (tr → tr-TR, en → en-US) Intl'e
// verilir. Liste/kartlarda "short", detay sayfalarında "long" kullanılır.

type DateInput = string | number | Date;

export type DateStyleKey = "short" | "long" | "full" | "dateOnly";

const STYLES: Record<DateStyleKey, Intl.DateTimeFormatOptions> = {
  short: { dateStyle: "medium", timeStyle: "short" },
  long: { dateStyle: "long", timeStyle: "short" },
  full: { dateStyle: "full", timeStyle: "short" },
  dateOnly: { dateStyle: "medium" },
};

/** Aktif locale'e göre tarih+saat biçimler (varsayılan: liste/kart "short"). */
export function formatDateTime(
  value: DateInput,
  locale: string,
  style: DateStyleKey = "short",
): string {
  return new Intl.DateTimeFormat(locale, STYLES[style]).format(new Date(value));
}
