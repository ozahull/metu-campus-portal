// D8 — Ham DB/RPC/RLS hata metni SON KULLANICIYA GÖSTERİLMEZ (politika/şema
// keşfini kolaylaştırır; ayrıca yerelleştirilemez). Desen: console.error ile
// logla, kullanıcıya SABİT t() metni göster. Hata türüne göre ayırt edici
// mesaj gerekiyorsa (ör. "kapasite dolu" vs "yetkiniz yok") RPC'lerin bilinen
// RAISE metinleri buradaki eşleyiciyle i18n anahtarına çevrilir — eşleşmeyen
// her şey genel mesaja düşer, ham metin asla basılmaz.

/** [aranan alt dize, i18n alt anahtarı] çiftleri — sıra öncelik belirler. */
export type KnownErrorPatterns = ReadonlyArray<readonly [string, string]>;

export function knownErrorKey(
  message: string | null | undefined,
  patterns: KnownErrorPatterns,
): string | null {
  if (!message) return null;
  for (const [needle, key] of patterns) {
    if (message.includes(needle)) return key;
  }
  return null;
}
