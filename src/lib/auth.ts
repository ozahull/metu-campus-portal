// Kimlik doğrulama akışında paylaşılan sabitler ve yardımcılar.

/** İzin verilen kurumsal e-posta alan adları. */
export const ALLOWED_DOMAINS = ["@metu.edu.tr", "@ncc.metu.edu.tr"] as const;

/** Verilen e-posta izin verilen ODTÜ alan adlarından biriyle mi bitiyor? */
export function isAllowedEmail(email: string): boolean {
  const value = email.trim().toLowerCase();
  return ALLOWED_DOMAINS.some((domain) => value.endsWith(domain));
}
