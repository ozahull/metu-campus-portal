// Kullanıcı-girdisi harici URL'lerinin güvenli işlenmesi.
//
// React bir href'i SANITIZE ETMEZ: `javascript:`/`data:`/`vbscript:` şemalı bir
// URL <a href>'e basıldığında React yalnızca dev-konsol uyarısı verir, tıklamada
// tarayıcı onu çalıştırır (stored XSS). Ancak şema süzgeci TEK BAŞINA yetmez:
// `https://instagram.com@evil.com` geçerli https'tir ama GERÇEK host'u evil.com'dur
// (userinfo aldatması) — güvenilir portal görünümüyle phishing (kulüp sayfasını gören
// yüzlerce üye "instagram.com" sanıp evil.com'a gider). Bu yüzden harici linkler
// PARSE edilir; şema, userinfo/port ve GERÇEK hostname bir allow-list'e göre doğrulanır.
//
// Allow-list, DB `is_safe_notification_link` (20260719230000) ve `public/sw.js`
// `safeTargetUrl` ile AYNI kümedir — 3 katmanlı savunma. Her katman kendi çalışma
// bağlamında (SQL / service worker / uygulama) kopya tutmak ZORUNDA; TS tarafında
// TEK yer burasıdır. ⚠️ Bu listeyi düzenlerken DİĞER İKİ katmanı da güncelle.
//
// mailto:/tel: alanları buradan GEÇMEZ — onlar kod tarafından şema-önekli üretilir
// (`mailto:${email}`), güvenlidir.

/** İzinli harici host'lar (tam eşleşme). *.metu.edu.tr alt alanları ayrıca izinli. */
const ALLOWED_EXTERNAL_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "wa.me",
  "chat.whatsapp.com",
  "metu.edu.tr",
]);

/** GERÇEK (parse edilmiş) hostname izinli mi? (string önekine DEĞİL host'a bakılır) */
function isAllowedExternalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_EXTERNAL_HOSTS.has(h) || h.endsWith(".metu.edu.tr");
}

// Geçerliyse normalize edilmiş https URL'sini, aksi halde null döner. null → link
// render edilmez (çağıranın sorumluluğu).
export function safeExternalHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  // Yalnız https (DB allow-list kuralı da https). javascript:/data:/mailto: elenir.
  if (url.protocol !== "https:") return null;
  // Userinfo/port aldatması: kullanıcı adı/şifre/açık port içeren URL reddedilir.
  // `https://instagram.com@evil.com` → username="instagram.com", host=evil.com;
  // `https://evil.com@instagram.com` → host izinli ama userinfo var → yine red.
  // (DB host regex'i de authority'de '@'/':' görünce eşleşmez.)
  if (url.username !== "" || url.password !== "" || url.port !== "") return null;
  // GERÇEK host allow-list'te mi?
  if (!isAllowedExternalHost(url.hostname)) return null;
  return url.href;
}

// Form doğrulaması: alan boş (opsiyonel) VEYA izinli bir harici link mi?
export function isValidExternalUrl(raw: string): boolean {
  return raw.trim() === "" || safeExternalHref(raw) !== null;
}
