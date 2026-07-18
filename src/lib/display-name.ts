// İsim gösterimi tek kuralı: full_name yoksa e-postanın @ ÖNCESİ yerel kısmına
// düşülür — HAM/tam e-posta asla isim olarak gösterilmez (dashboard karşılama,
// navbar/UserMenu, profil başlığı). Başka kullanıcıların e-postası istemciden
// zaten OKUNAMAZ (profiles kolon-grant'ı) — üye listeleri/mesajlar isimsiz
// kullanıcıda t("unnamed*") çeviri fallback'lerini kullanmaya devam eder.
export function resolveDisplayName(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const name = fullName?.trim();
  if (name) return name;
  const local = email?.split("@")[0]?.trim();
  return local ? local : null;
}
