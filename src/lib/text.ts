// Hydration güvenliği (React #418 sınıfı — D6/Tur 3 ek bulgu): HTML parser'ı
// SSR HTML'indeki \r\n ve \r karakterlerini tokenizasyondan ÖNCE \n'e indirger
// (HTML spec). DB'den \r\n (CRLF) içeren kullanıcı metni gelirse DOM'daki metin
// React'in beklediği ham metinden farklı düşer ve hard-load'da "text mismatch"
// hydration hatası doğar — sunucu bileşeni metni için bile. Kullanıcı üretimi
// ÇOK SATIRLI metin (açıklama/vizyon) render edilmeden önce buradan geçmeli;
// yazma yolunda da normalize edilir ama eski satırlar için render tarafı ŞART.
export function normalizeMultiline(s: string): string;
export function normalizeMultiline(s: string | null | undefined): string | null;
export function normalizeMultiline(
  s: string | null | undefined,
): string | null {
  if (s == null) return null;
  return s.replace(/\r\n?/g, "\n");
}
