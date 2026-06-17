// Desteklenen diller ve varsayılan. Path routing YOK — dil cookie ile seçilir.
export const locales = ["tr", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "tr";

// Dil değişimini saklayan cookie adı (next-intl varsayılanı ile uyumlu).
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value);
}
