// Kullanıcı-girdisi harici URL'lerinin güvenli işlenmesi.
//
// React bir href'i SANITIZE ETMEZ: `javascript:`/`data:`/`vbscript:` şemalı bir
// URL <a href>'e basıldığında React yalnızca dev-konsol uyarısı verir, tıklamada
// tarayıcı onu çalıştırır (stored XSS). Bu yüzden kullanıcı-girdisi harici linkler
// (whatsapp_url, instagram_url, gelecekteki http URL alanları) HEM formda
// doğrulanır HEM render'dan önce bu yardımcıdan geçer. mailto:/tel: alanları buradan
// GEÇMEZ — onlar kod tarafından şema-önekli üretilir (`mailto:${email}`), güvenlidir.

// Geçerliyse normalize edilmiş http(s) URL'sini, aksi halde null döner. null → link
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
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.href;
}

// Form doğrulaması: alan boş (opsiyonel) VEYA geçerli bir http(s) URL mi?
export function isValidExternalUrl(raw: string): boolean {
  return raw.trim() === "" || safeExternalHref(raw) !== null;
}
