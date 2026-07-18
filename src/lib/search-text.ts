// İstemci-içi arama/filtre için Türkçe-güvenli normalizasyon (O18).
// Düz toLowerCase() Türkçe I/ı tuzağına düşer: "İnovasyon".toLowerCase() =
// "i̇novasyon" (noktalı i + combining dot), "IŞIK".toLowerCase() = "işik" —
// Türkçe klavye girişi ("ışık") bunları BULAMAZ. Çözüm: Türkçe/aksanlı
// harfleri toLowerCase'den ÖNCE ASCII'ye indirger (name-from-email.ts
// normalizeNameToken deseni) — hem sorgu hem hedef aynı kanonik biçime iner,
// ASCII klavyeyle yazılmış sorgu ("isik") da Türkçe metni bulur.
// Kullanıcı metni karşılaştıran HER istemci filtresi buradan geçmeli;
// sayfa-yerel toLowerCase() karşılaştırması YAZMA.

const TR_ASCII_MAP: Record<string, string> = {
  ğ: "g", Ğ: "g", ü: "u", Ü: "u", ş: "s", Ş: "s", ı: "i", İ: "i",
  ö: "o", Ö: "o", ç: "c", Ç: "c", â: "a", Â: "a", î: "i", Î: "i", û: "u", Û: "u",
};

/** Kanonik arama biçimi: Türkçe→ASCII + küçük harf (rakam/boşluk korunur). */
export function normalizeSearchText(s: string | null | undefined): string {
  const mapped = (s ?? "").replace(
    /[ğĞüÜşŞıİöÖçÇâÂîÎûÛ]/g,
    (c) => TR_ASCII_MAP[c] ?? c,
  );
  return mapped.toLowerCase();
}

/** hedef metin, normalize edilmiş sorguyu içeriyor mu? (sorguyu çağıran
 *  tarafta bir kez normalizeSearchText ile hazırla, döngüde bunu kullan.) */
export function searchIncludes(
  haystack: string | null | undefined,
  normalizedQuery: string,
): boolean {
  return normalizeSearchText(haystack).includes(normalizedQuery);
}
