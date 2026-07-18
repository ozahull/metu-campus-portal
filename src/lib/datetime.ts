// Ortak tarih/saat biçimlendirme — TÜM gösterimler buradan geçer ki sayfa
// sayfa format farkı olmasın. Aktif locale (tr → tr-TR, en → en-US) Intl'e
// verilir. Liste/kartlarda "short", detay sayfalarında "long" kullanılır.
//
// SAAT DİLİMİ SABİT: Europe/Istanbul. Etkinlik saati KAMPÜS saatidir —
// sunucu (Vercel, UTC) ve tarayıcı hangi dilimde olursa olsun aynı metin
// üretilmeli. TZ'siz Intl kullanımı sunucu/istemci farkı → React #418
// hydration hatası + liste/detay saat tutarsızlığı doğurur. Yeni bir
// biçimlendirici gerekiyorsa appDateTimeFormat() üzerinden kur; çıplak
// new Intl.DateTimeFormat / toLocaleString YAZMA.

type DateInput = string | number | Date;

/** Kampüs saat dilimi — tüm tarih/saat gösterimlerinin tek referansı. */
export const APP_TIME_ZONE = "Europe/Istanbul";

// Türkiye 2016'dan beri kalıcı UTC+3 (yaz saati yok); gün sınırı ve
// datetime-local dönüşümleri bu sabit ofsetle deterministik yapılabilir.
const APP_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

export const DAY_MS = 86_400_000;

export type DateStyleKey = "short" | "long" | "full" | "dateOnly";

const STYLES: Record<DateStyleKey, Intl.DateTimeFormatOptions> = {
  short: { dateStyle: "medium", timeStyle: "short" },
  long: { dateStyle: "long", timeStyle: "short" },
  full: { dateStyle: "full", timeStyle: "short" },
  dateOnly: { dateStyle: "medium" },
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Verilen anı kampüs duvar saatine kaydırır; UTC getter'larıyla okunur. */
function shiftToAppWallClock(value: DateInput): Date {
  return new Date(new Date(value).getTime() + APP_UTC_OFFSET_MS);
}

/** Kampüs dilimine sabitlenmiş Intl biçimlendirici — özel düzenler
 *  (DateBadge, takvim başlıkları, ay etiketi) bunun üzerinden kurulur. */
export function appDateTimeFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    ...options,
  });
}

/** Aktif locale'e göre tarih+saat biçimler (varsayılan: liste/kart "short"). */
export function formatDateTime(
  value: DateInput,
  locale: string,
  style: DateStyleKey = "short",
): string {
  return appDateTimeFormat(locale, STYLES[style]).format(new Date(value));
}

/** Kampüs dilimindeki takvim günü anahtarı (YYYY-MM-DD) — gün gruplama ve
 *  bugün/dün karşılaştırmaları için (mesaj ayracı, takvim, rapor aralığı). */
export function appDayKey(value: DateInput): string {
  const d = shiftToAppWallClock(value);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Kampüs gününün başlangıcı (İstanbul gece yarısı) — gerçek an döner. */
export function startOfAppDay(value: DateInput): Date {
  const d = shiftToAppWallClock(value);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
      APP_UTC_OFFSET_MS,
  );
}

/** Kampüs dilimindeki haftanın günü (Pazartesi=0 … Pazar=6). */
export function appDayOfWeek(value: DateInput): number {
  return (shiftToAppWallClock(value).getUTCDay() + 6) % 7;
}

/** An → <input type="datetime-local"> değeri, kampüs duvar saatiyle. */
export function toAppDateTimeInput(value: DateInput): string {
  const d = shiftToAppWallClock(value);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** datetime-local değeri (kampüs duvar saati kabul edilir) → ISO an (UTC).
 *  Tarayıcı TZ'sine göre DEĞİL — formda yazılan saat kampüs saatidir. */
export function fromAppDateTimeInput(value: string): string {
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return new Date(`${withSeconds}+03:00`).toISOString();
}
