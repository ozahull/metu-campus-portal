// PostgREST embed normalizasyonu: ilişki, FK tanımına göre TEK OBJE ya da tek
// elemanlı DİZİ dönebilir — çağıran tarafta tek biçime indirger. (Hijyen turu:
// tickets/checkin/manage/kulüp-detay sayfalarındaki dört yerel kopya buraya indi.)
export function unwrapEmbed<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
