// Kulüp/etkinlik kategorisi DB'de SERBEST METİNDİR (tarihsel olarak Türkçe
// girildi). Gösterim katmanında bilinen değerler i18n'e çevrilir (messages
// "categories" namespace'i, tr+en parite); bilinmeyen değer olduğu gibi
// gösterilir. DB değeri DEĞİŞMEZ ve filtre/eşleşme her zaman HAM değerle
// yapılır — yalnızca etiket çevrilir.

type TFunc = (key: string) => string;

// Bilinen yazımlar (tr + en, küçük harf) → categories.* anahtarı. Anahtarların
// TAMAMI messages/tr.json ve en.json'da tanımlı olmalı (t() asla kaçırmaz).
const CATEGORY_KEYS: Record<string, string> = {
  teknoloji: "technology",
  technology: "technology",
  spor: "sports",
  sports: "sports",
  sanat: "arts",
  arts: "arts",
  art: "arts",
  müzik: "music",
  music: "music",
  bilim: "science",
  science: "science",
  kültür: "culture",
  culture: "culture",
  edebiyat: "literature",
  literature: "literature",
  sosyal: "social",
  social: "social",
  akademik: "academic",
  academic: "academic",
  oyun: "games",
  games: "games",
  gaming: "games",
  dans: "dance",
  dance: "dance",
  tiyatro: "theatre",
  theatre: "theatre",
  theater: "theatre",
  fotoğrafçılık: "photography",
  fotoğraf: "photography",
  photography: "photography",
  doğa: "nature",
  nature: "nature",
  gönüllülük: "volunteering",
  volunteering: "volunteering",
  girişimcilik: "entrepreneurship",
  entrepreneurship: "entrepreneurship",
  mühendislik: "engineering",
  engineering: "engineering",
  medya: "media",
  media: "media",
};

/** Kategori değeri → aktif dilde etiket. t "categories" namespace'ine bağlı
 *  olmalı (useTranslations("categories") / getTranslations("categories")). */
export function categoryLabel(
  value: string | null | undefined,
  t: TFunc,
): string | null {
  if (!value) return null;
  const raw = value.trim();
  // Çift arama: tr küçük harf ("İ"→"i") + standart ("I"→"i") — iki dilin
  // büyük harfli yazımları da yakalanır.
  const key =
    CATEGORY_KEYS[raw.toLocaleLowerCase("tr")] ??
    CATEGORY_KEYS[raw.toLowerCase()];
  return key ? t(key) : raw;
}
