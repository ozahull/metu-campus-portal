// KVKK / gizlilik: Sentry'ye ASLA PII (kişisel veri) gönderme.
//
// Bu modül SAF (yan etkisiz) fonksiyonlarla bir Sentry "event"ini ve
// "breadcrumb"larını temizler. Üç Sentry init'i (client/server/edge) bunları
// `beforeSend` / `beforeBreadcrumb` olarak kullanır — tek kaynak, tek davranış.
// Testi: sentry-scrub.test.ts (npm test).
//
// Strateji (savunmacı, birden çok katman):
//  1) Kullanıcı kimliği YALNIZCA `id` — e-posta / ad / ip düşürülür.
//  2) İstek gövdesi/başlıkları/çerezleri: çerez ve Authorization tamamen silinir.
//  3) URL query string'inden hassas parametreler (code, token, ...) çıkarılır.
//  4) Herhangi bir derinlikte, anahtar adı hassas desene uyan alanın DEĞERİ
//     maskelenir (e-posta, ad, bio, mesaj gövdesi, bilet token'ı, iban, telefon…).
//  5) Breadcrumb'lardaki URL'ler ve veriler aynı kurallarla temizlenir.

type AnyRecord = Record<string, unknown>;

// Anahtar adı bu desenlerden birine uyarsa, o alanın DEĞERİ maskelenir.
// (Mesaj içeriği, dekont, bilet token'ı, IBAN, telefon, ad, e-posta dâhil.)
const SENSITIVE_KEY =
  /(e[-_]?mail|e[-_]?posta|full[_-]?name|display[_-]?name|first[_-]?name|last[_-]?name|isim|ad_?soyad|username|bio|body|preview|message|mesaj|content|icerik|token|password|parola|sifre|şifre|secret|authorization|cookie|set-cookie|receipt|dekont|iban|phone|telefon|gsm|avatar_url|address|adres)/i;

// URL query string'inde tamamen kaldırılacak hassas parametreler.
const SENSITIVE_QS =
  /^(code|token|access[_-]?token|refresh[_-]?token|id[_-]?token|apikey|api[_-]?key|secret|password|otp|email)$/i;

const REDACTED = "[Filtered]";
const MAX_DEPTH = 6;

/** URL'deki hassas query parametrelerini maskeler (yolu korur). */
export function scrubUrl(url: unknown): unknown {
  if (typeof url !== "string" || url.length === 0) return url;
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return url;
  const base = url.slice(0, qIndex);
  const query = url.slice(qIndex + 1);
  const cleaned = query
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      const key = eq === -1 ? pair : pair.slice(0, eq);
      if (SENSITIVE_QS.test(decodeURIComponent(key))) {
        return `${key}=${REDACTED}`;
      }
      return pair;
    })
    .join("&");
  return `${base}?${cleaned}`;
}

/** Bir değeri (obje/dizi/ilkel) hassas-anahtar kuralıyla derinlemesine temizler. */
export function deepRedact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_DEPTH) return value;

  if (Array.isArray(value)) {
    return value.map((item) => deepRedact(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: AnyRecord = {};
    for (const [key, val] of Object.entries(value as AnyRecord)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = REDACTED;
      } else if (key === "url" || key === "URL") {
        out[key] = scrubUrl(val);
      } else {
        out[key] = deepRedact(val, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export interface ScrubbableBreadcrumb {
  message?: unknown;
  data?: AnyRecord | null;
  [k: string]: unknown;
}

export interface ScrubbableEvent {
  user?: AnyRecord | null;
  request?: AnyRecord | null;
  extra?: AnyRecord | null;
  contexts?: AnyRecord | null;
  breadcrumbs?: ScrubbableBreadcrumb[] | null;
  [k: string]: unknown;
}

/** Tek bir breadcrumb'ı temizler (fetch/xhr URL'leri + veri alanları). */
export function scrubBreadcrumb<T extends ScrubbableBreadcrumb>(crumb: T): T {
  if (!crumb || typeof crumb !== "object") return crumb;
  const next = { ...crumb };
  if (next.data && typeof next.data === "object") {
    const data = { ...(next.data as AnyRecord) };
    if ("url" in data) data.url = scrubUrl(data.url);
    next.data = deepRedact(data) as AnyRecord;
  }
  return next;
}

/**
 * Sentry event'ini KVKK-güvenli hâle getirir. Aynı referansı değiştirmez;
 * temizlenmiş bir kopya döndürür (Sentry beforeSend bunu bekler).
 */
// --- Sentry init'lerinin doğrudan kullandığı, Sentry-tipli sarmalayıcılar ---
// (Type-only import; runtime'da SDK'yı çekmez → saf test SDK'sız kalır.)
// scrubEvent/scrubBreadcrumb yapısal (gevşek) tiplerle çalışır; burada Sentry'nin
// ErrorEvent/Breadcrumb tipine köprülenir ki config'lerde cast gerekmesin.
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

export function beforeSendScrub(event: ErrorEvent): ErrorEvent {
  return scrubEvent(event as unknown as ScrubbableEvent) as unknown as ErrorEvent;
}

export function beforeBreadcrumbScrub(breadcrumb: Breadcrumb): Breadcrumb {
  return scrubBreadcrumb(
    breadcrumb as unknown as ScrubbableBreadcrumb,
  ) as unknown as Breadcrumb;
}

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const next: ScrubbableEvent = { ...event };

  // 1) Kullanıcı: yalnızca id kalsın (e-posta/ad/ip/username düşür).
  if (next.user && typeof next.user === "object") {
    const id = (next.user as AnyRecord).id;
    next.user = id === undefined || id === null ? {} : { id };
  }

  // 2) İstek: çerez/başlık/gövde/query temizliği.
  if (next.request && typeof next.request === "object") {
    const req = { ...(next.request as AnyRecord) };
    delete req.cookies;
    if (req.headers && typeof req.headers === "object") {
      const headers: AnyRecord = {};
      for (const [k, v] of Object.entries(req.headers as AnyRecord)) {
        headers[k] = SENSITIVE_KEY.test(k) ? REDACTED : v;
      }
      req.headers = headers;
    }
    if ("url" in req) req.url = scrubUrl(req.url);
    if ("query_string" in req) req.query_string = REDACTED;
    if ("data" in req) req.data = deepRedact(req.data);
    next.request = req;
  }

  // 3) Serbest kaplar: extra / contexts / breadcrumbs.
  if (next.extra) next.extra = deepRedact(next.extra) as AnyRecord;
  if (next.contexts) next.contexts = deepRedact(next.contexts) as AnyRecord;
  if (Array.isArray(next.breadcrumbs)) {
    next.breadcrumbs = next.breadcrumbs.map((b) => scrubBreadcrumb(b));
  }

  return next as T;
}
