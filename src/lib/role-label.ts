// Merkezî rol etiketi (D24): aynı rol her ekranda AYNI kelimeyle görünür.
// Terminoloji sabit — kulüp bağlamı: "Başkan" / "Üye"; okul bağlamı:
// "Süper yönetici" / "Danışman". Çeviriler messages/*.json "roleLabels"
// namespace'inde yaşar; yeni rol gösterim noktaları bu helper'dan geçmeli,
// sayfa-yerel rol anahtarı AÇMA.
//
// Girdi tek tip değil: profiles.role ('USER'|'ADVISOR'|'SUPER_ADMIN'),
// club_members.role ('ADMIN'|'MEMBER') ve get_profile RPC ilişkileri
// ('advisor'|'president'|'member') hepsi burada normalize edilir.
// club_members.'ADMIN' başkandır; profiles'ta 'ADMIN' değeri hiç yoktur,
// bu yüzden çakışma olmaz.

export type RoleLabelKey = "superAdmin" | "advisor" | "president" | "member";

type RoleTranslator = (key: RoleLabelKey) => string;

/** Ham rol/ilişki değerini roleLabels çeviri anahtarına normalize eder. */
export function roleLabelKey(role: string | null | undefined): RoleLabelKey {
  switch ((role ?? "").toString().trim().toUpperCase()) {
    case "SUPER_ADMIN":
      return "superAdmin";
    case "ADVISOR":
      return "advisor";
    case "ADMIN": // club_members.role — kulüp başkanı
    case "PRESIDENT":
      return "president";
    default: // 'USER', 'MEMBER' ve bilinmeyen her değer
      return "member";
  }
}

/** t = useTranslations("roleLabels") / getTranslations("roleLabels"). */
export function roleLabel(
  role: string | null | undefined,
  t: RoleTranslator,
): string {
  return t(roleLabelKey(role));
}
