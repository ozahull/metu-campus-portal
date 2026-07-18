// E-postadan gerçek-ad türetme + doğrulama. Kurumsal ODTÜ e-postaları ad.soyad####
// formatında ve kurumsal olarak doğrulanmıştır; bu yüzden gerçek ad e-postadan
// türetilebilir ve girilen ad e-posta ile eşleşmeye zorlanabilir ("Test Hocam" gibi
// sahte adları eler). SUNUCU tarafı AYNI mantığı SQL'de tekrarlar
// (20260719200000_verified_real_name.sql) — istemci doğrulaması güvenlik değildir.

import { normalizeSearchText } from "@/lib/search-text";

// Kanonik karşılaştırma anahtarı: Türkçe→ASCII + küçük harf + yalnız a-z.
// (Türkçe I/ı tuzağını önleyen dönüşüm artık ortak src/lib/search-text.ts'te —
// arama filtreleri de aynı normalizasyonu kullanır.)
export function normalizeNameToken(s: string): string {
  return normalizeSearchText(s).replace(/[^a-z]/g, "");
}

// E-posta yerelini (sondaki rakamlar atılmış) token'a indirger.
// "onur.esen2005@metu.edu.tr" → "onuresen".
function emailNameToken(email: string): string {
  const local = (email ?? "").split("@")[0] ?? "";
  return normalizeNameToken(local.replace(/[0-9]+$/, ""));
}

// Yerel kısımda (rakamlar atıldıktan sonra) nokta var mı → ad.soyad formatı,
// yani doğrulanabilir. Nokta yoksa (tek kelime) veya token boşsa doğrulama uygulanmaz.
export function isDerivableEmail(email: string): boolean {
  const local = ((email ?? "").split("@")[0] ?? "").replace(/[0-9]+$/, "");
  return local.includes(".") && emailNameToken(email) !== "";
}

// Türkçe-duyarlı Title Case (e-posta yereli ASCII gelir; kullanıcı sonradan
// Türkçe karakterlerle düzeltebilir — doğrulama normalize ile yine tutar).
function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase("tr") + s.slice(1).toLocaleLowerCase("tr");
}

// "onur.esen2005@metu.edu.tr" → { first: "Onur", last: "Esen" }.
// Türetilemezse (nokta yok / tek kelime / boş) null → çağıran alanı serbest bırakır.
export function deriveNameFromEmail(
  email: string,
): { first: string; last: string } | null {
  const local = (email ?? "").split("@")[0]?.trim() ?? "";
  const withoutDigits = local.replace(/[0-9]+$/, "");
  const parts = withoutDigits
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const titled = parts.map(titleCase);
  return { first: titled[0], last: titled.slice(1).join(" ") };
}

// Girilen ad, e-posta yerelinden türetilenle eşleşiyor mu (Türkçe düzeltmeye izinli).
export function nameMatchesEmail(name: string, email: string): boolean {
  const token = emailNameToken(email);
  return token !== "" && normalizeNameToken(name) === token;
}
