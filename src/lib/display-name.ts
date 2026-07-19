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

// Avatar baş harfleri TEK kuralı (hijyen turu — navbar/u/[id]/profil'deki üç
// kopya buraya indi): iki+ kelimede ilk iki kelimenin baş harfi; tek kelimede
// ilk iki karakter (navbar'ın e-posta fallback davranışı); boş kaynakta "?".
export function nameInitials(source: string | null | undefined): string {
  const parts = (source ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0]?.slice(0, 2).toUpperCase() ?? "") || "?";
}
