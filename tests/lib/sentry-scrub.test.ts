// src/lib/sentry-scrub.ts — Sentry'ye giden event'lerden PII temizliği (KVKK).
// Bu testler, hata izleme kurulumunun ÖĞRENCİ VERİSİNİ (e-posta, ad, mesaj
// içeriği, bilet token'ı, çerez, ?code= URL parametresi) Sentry'ye SIZDIRMADIĞINI
// kilitler. beforeSend/beforeBreadcrumb bu saf fonksiyonları kullanır.
import { describe, expect, it } from "vitest";
import {
  deepRedact,
  isIpGeoHeader,
  scrubBreadcrumb,
  scrubEvent,
  scrubUrl,
  stripUrlQuery,
} from "@/lib/sentry-scrub";

describe("scrubUrl — hassas query parametreleri", () => {
  it("?code= ve token'ları maskeler, yolu korur", () => {
    expect(scrubUrl("https://x.app/auth/callback?code=SECRET&next=/dashboard")).toBe(
      "https://x.app/auth/callback?code=[Filtered]&next=/dashboard",
    );
    expect(scrubUrl("https://x.app/r?access_token=abc&x=1")).toBe(
      "https://x.app/r?access_token=[Filtered]&x=1",
    );
  });

  it("query'siz URL ve ilkel olmayan girdi olduğu gibi döner", () => {
    expect(scrubUrl("https://x.app/dashboard")).toBe("https://x.app/dashboard");
    expect(scrubUrl(undefined)).toBeUndefined();
    expect(scrubUrl(123)).toBe(123);
  });
});

describe("deepRedact — hassas anahtarların değeri maskelenir", () => {
  it("e-posta / ad / mesaj gövdesi / token / iban / telefon maskelenir", () => {
    const out = deepRedact({
      email: "a@metu.edu.tr",
      full_name: "Ada Lovelace",
      body: "gizli mesaj içeriği",
      token: "AB12CD34EF",
      iban: "TR000000",
      phone: "+90555",
      keep: "bu kalır",
    }) as Record<string, unknown>;
    expect(out.email).toBe("[Filtered]");
    expect(out.full_name).toBe("[Filtered]");
    expect(out.body).toBe("[Filtered]");
    expect(out.token).toBe("[Filtered]");
    expect(out.iban).toBe("[Filtered]");
    expect(out.phone).toBe("[Filtered]");
    expect(out.keep).toBe("bu kalır");
  });

  it("iç içe obje/dizi içinde de maskeler ve url alanını temizler", () => {
    const out = deepRedact({
      level1: { message: "x", nested: [{ email: "b@c.com" }] },
      url: "https://x.app/cb?token=zzz",
    }) as Record<string, unknown>;
    const level1 = out.level1 as Record<string, unknown>;
    expect(level1.message).toBe("[Filtered]");
    expect((level1.nested as Array<Record<string, unknown>>)[0].email).toBe(
      "[Filtered]",
    );
    expect(out.url).toBe("https://x.app/cb?token=[Filtered]");
  });
});

describe("scrubEvent — event bütünsel temizlik", () => {
  it("kullanıcıdan yalnız id + null ip kalır; e-posta/username/ip/geo düşer", () => {
    const out = scrubEvent({
      user: {
        id: "uuid-123",
        email: "a@metu.edu.tr",
        username: "ada",
        ip_address: "1.2.3.4",
        geo: { country_code: "TR", city: "Ankara", subdivision: "06" },
      },
    });
    // ip_address AÇIKÇA null (Sentry sunucusu geo türetmesin); geo düşer.
    expect(out.user).toEqual({ id: "uuid-123", ip_address: null });
  });

  it("id yoksa kullanıcı yalnız null ip'e iner (PII kalmaz)", () => {
    const out = scrubEvent({ user: { email: "a@metu.edu.tr" } });
    expect(out.user).toEqual({ ip_address: null });
  });

  it("istek: cookies/data/query_string + Cookie/Authorization başlığı SİLİNİR; url maskeli, User-Agent kalır", () => {
    const out = scrubEvent({
      request: {
        url: "https://x.app/reset?token=zzz",
        cookies: { "sb-access-token": "secret" },
        headers: { Cookie: "a=b", Authorization: "Bearer x", "User-Agent": "UA" },
        query_string: "token=zzz",
        data: { body: "mesaj", ok: "kalir" },
      },
    });
    const req = out.request as Record<string, unknown>;
    expect(req.cookies).toBeUndefined();
    expect(req.data).toBeUndefined();
    expect(req.query_string).toBeUndefined();
    const headers = req.headers as Record<string, unknown>;
    expect(headers.Cookie).toBeUndefined();
    expect(headers.Authorization).toBeUndefined();
    expect(headers["User-Agent"]).toBe("UA");
    // url yalnız hassas parametresi maskelenerek kalır (yol + debug için).
    expect(req.url).toBe("https://x.app/reset?token=[Filtered]");
  });

  it("extra maskeli; breadcrumb data SİLİNİR (yalnız path'li url kalır)", () => {
    const out = scrubEvent({
      extra: { messageBody: "gizli", note: "kalir" },
      breadcrumbs: [
        { message: "nav", data: { url: "https://x.app/cb?code=zzz", email: "a@b.com" } },
      ],
    });
    // messageBody anahtarı "body" desenine uyar → maskelenir.
    expect((out.extra as Record<string, unknown>).messageBody).toBe("[Filtered]");
    expect((out.extra as Record<string, unknown>).note).toBe("kalir");
    const crumbData = out.breadcrumbs![0].data as Record<string, unknown>;
    // data payload'ı silindi: yalnız query'siz url kaldı, email GİTTİ.
    expect(crumbData.url).toBe("https://x.app/cb");
    expect(crumbData.email).toBeUndefined();
  });

  it("orijinal event'i mutasyona uğratmaz (kopya döndürür)", () => {
    const original = { user: { id: "1", email: "a@b.com" } };
    scrubEvent(original);
    expect(original.user.email).toBe("a@b.com");
  });
});

describe("scrubBreadcrumb — fetch/xhr izi", () => {
  it("data payload'ı silinir; yalnız query'siz url kalır (path)", () => {
    const out = scrubBreadcrumb({
      category: "fetch",
      data: { url: "https://x.app/api?token=zzz", email: "a@b.com" },
    });
    const data = out.data as Record<string, unknown>;
    expect(data.url).toBe("https://x.app/api");
    expect(data.email).toBeUndefined();
  });

  it("message bir URL ise query string atılır (path kalır)", () => {
    const out = scrubBreadcrumb({
      category: "navigation",
      message: "https://x.app/reset?token=zzz",
    });
    expect(out.message).toBe("https://x.app/reset");
  });

  it("url'siz data tamamen düşer", () => {
    const out = scrubBreadcrumb({
      category: "xhr",
      data: { body: "gizli gövde", email: "a@b.com" },
    });
    expect(out.data).toBeUndefined();
  });
});

describe("stripUrlQuery — query + fragment atılır, path kalır", () => {
  it("query string'i düşürür", () => {
    expect(stripUrlQuery("https://x.app/reset?token=zzz&e=a@b.com")).toBe(
      "https://x.app/reset",
    );
  });
  it("fragment'i düşürür (oturum token'ı fragment'te olabilir)", () => {
    expect(stripUrlQuery("https://x.app/cb#access_token=zzz")).toBe(
      "https://x.app/cb",
    );
  });
  it("query'siz URL ve ilkel olmayan girdi olduğu gibi döner", () => {
    expect(stripUrlQuery("https://x.app/dashboard")).toBe(
      "https://x.app/dashboard",
    );
    expect(stripUrlQuery(undefined)).toBeUndefined();
    expect(stripUrlQuery(123)).toBe(123);
  });
});

// Genişletilmiş PII silme (KVKK) — beforeSend'in 5 hassas kabı MASKELEMEZ, SİLER.
// Her vaka: o PII'yi taşıyan sahte event → çıktıda sızıntı YOK.
describe("scrubEvent — genişletilmiş PII silme (KVKK, 5 vaka)", () => {
  it("1) request.data (gövde) silinir", () => {
    const out = scrubEvent({
      request: { data: { body: "gizli mesaj", email: "a@metu.edu.tr" } },
    });
    expect((out.request as Record<string, unknown>).data).toBeUndefined();
  });

  it("2) request.cookies silinir", () => {
    const out = scrubEvent({
      request: { cookies: { "sb-access-token": "secret", session: "abc" } },
    });
    expect((out.request as Record<string, unknown>).cookies).toBeUndefined();
  });

  it("3) Authorization başlığı silinir (küçük-büyük harf duyarsız), diğer başlık kalır", () => {
    const out = scrubEvent({
      request: {
        headers: { authorization: "Bearer gizli-token", "x-ok": "kalir" },
      },
    });
    const headers = (out.request as Record<string, unknown>).headers as Record<
      string,
      unknown
    >;
    expect(headers.authorization).toBeUndefined();
    expect(headers["x-ok"]).toBe("kalir");
  });

  it("4) request.query_string silinir", () => {
    const out = scrubEvent({
      request: { query_string: "token=zzz&email=a@b.com" },
    });
    expect(
      (out.request as Record<string, unknown>).query_string,
    ).toBeUndefined();
  });

  it("5) breadcrumb data payload'ı silinir", () => {
    const out = scrubEvent({
      breadcrumbs: [
        {
          category: "fetch",
          data: { requestBody: "gizli", email: "a@b.com", token: "T" },
        },
      ],
    });
    expect(out.breadcrumbs![0].data).toBeUndefined();
  });
});

// IP / coğrafi konum sızıntısı (KVKK) — Sentry, IP'den kullanıcının şehrini,
// enlem/boylamını (event.user.geo) VE ip_address'ini türetir. Bu blok, hem
// kullanıcı hem istek-başlığı vektörlerinin tamamen temizlendiğini kilitler.
describe("isIpGeoHeader — IP/geo taşıyan başlık adları", () => {
  it("tam adlar eşleşir (x-forwarded-for / x-real-ip / x-vercel-proxied-for)", () => {
    expect(isIpGeoHeader("x-forwarded-for")).toBe(true);
    expect(isIpGeoHeader("x-real-ip")).toBe(true);
    expect(isIpGeoHeader("x-vercel-proxied-for")).toBe(true);
  });
  it("x-vercel-ip-* prefix'i (şehir/enlem/boylam/posta kodu/ülke) eşleşir", () => {
    expect(isIpGeoHeader("x-vercel-ip-city")).toBe(true);
    expect(isIpGeoHeader("x-vercel-ip-latitude")).toBe(true);
    expect(isIpGeoHeader("x-vercel-ip-longitude")).toBe(true);
    expect(isIpGeoHeader("x-vercel-ip-postal-code")).toBe(true);
    expect(isIpGeoHeader("x-vercel-ip-country")).toBe(true);
    expect(isIpGeoHeader("x-vercel-ip-country-region")).toBe(true);
  });
  it("zararsız başlıklar eşleşmez (user-agent / accept / x-ok)", () => {
    expect(isIpGeoHeader("user-agent")).toBe(false);
    expect(isIpGeoHeader("accept")).toBe(false);
    expect(isIpGeoHeader("x-ok")).toBe(false);
  });
});

describe("scrubEvent — IP/coğrafi konum silme (KVKK: Sentry IP'den geo türetmesin)", () => {
  it("user.geo silinir; ip_address null'a çekilir; yalnız id kalır", () => {
    const out = scrubEvent({
      user: {
        id: "uuid-1",
        ip_address: "88.240.1.2",
        geo: { country_code: "TR", city: "Ankara", subdivision: "06" },
      },
    });
    const user = out.user as Record<string, unknown>;
    expect(user.geo).toBeUndefined();
    expect(user.ip_address).toBeNull();
    expect(user.id).toBe("uuid-1");
  });

  it("id yoksa bile ip_address null kalır (bağlantı IP'sinden geo türetimini engeller)", () => {
    const out = scrubEvent({
      user: { ip_address: "88.240.1.2", geo: { city: "Ankara" } },
    });
    expect(out.user).toEqual({ ip_address: null });
  });

  it("IP/geo taşıyan istek başlıkları TAMAMEN silinir; zararsız başlık kalır", () => {
    const out = scrubEvent({
      request: {
        headers: {
          "X-Forwarded-For": "88.240.1.2, 10.0.0.1",
          "X-Real-Ip": "88.240.1.2",
          "X-Vercel-Proxied-For": "88.240.1.2",
          "X-Vercel-Ip-City": "Ankara",
          "X-Vercel-Ip-Country": "TR",
          "X-Vercel-Ip-Latitude": "39.93",
          "X-Vercel-Ip-Longitude": "32.85",
          "X-Vercel-Ip-Postal-Code": "06000",
          "User-Agent": "UA",
        },
      },
    });
    const headers = (out.request as Record<string, unknown>).headers as Record<
      string,
      unknown
    >;
    expect(headers["X-Forwarded-For"]).toBeUndefined();
    expect(headers["X-Real-Ip"]).toBeUndefined();
    expect(headers["X-Vercel-Proxied-For"]).toBeUndefined();
    expect(headers["X-Vercel-Ip-City"]).toBeUndefined();
    expect(headers["X-Vercel-Ip-Country"]).toBeUndefined();
    expect(headers["X-Vercel-Ip-Latitude"]).toBeUndefined();
    expect(headers["X-Vercel-Ip-Longitude"]).toBeUndefined();
    expect(headers["X-Vercel-Ip-Postal-Code"]).toBeUndefined();
    // Zararsız başlık (debug için) korunur.
    expect(headers["User-Agent"]).toBe("UA");
  });

  it("başlık adı büyük/küçük harf duyarsız eşleşir (lowercase varyant da silinir)", () => {
    const out = scrubEvent({
      request: {
        headers: { "x-vercel-ip-timezone": "Europe/Istanbul", "x-ok": "kalir" },
      },
    });
    const headers = (out.request as Record<string, unknown>).headers as Record<
      string,
      unknown
    >;
    expect(headers["x-vercel-ip-timezone"]).toBeUndefined();
    expect(headers["x-ok"]).toBe("kalir");
  });
});
