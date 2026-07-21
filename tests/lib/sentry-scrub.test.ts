// src/lib/sentry-scrub.ts — Sentry'ye giden event'lerden PII temizliği (KVKK).
// Bu testler, hata izleme kurulumunun ÖĞRENCİ VERİSİNİ (e-posta, ad, mesaj
// içeriği, bilet token'ı, çerez, ?code= URL parametresi) Sentry'ye SIZDIRMADIĞINI
// kilitler. beforeSend/beforeBreadcrumb bu saf fonksiyonları kullanır.
import { describe, expect, it } from "vitest";
import {
  deepRedact,
  scrubBreadcrumb,
  scrubEvent,
  scrubUrl,
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
  it("kullanıcıdan yalnız id kalır; e-posta/username/ip düşer", () => {
    const out = scrubEvent({
      user: {
        id: "uuid-123",
        email: "a@metu.edu.tr",
        username: "ada",
        ip_address: "1.2.3.4",
      },
    });
    expect(out.user).toEqual({ id: "uuid-123" });
  });

  it("id yoksa kullanıcı boş nesneye iner (PII kalmaz)", () => {
    const out = scrubEvent({ user: { email: "a@metu.edu.tr" } });
    expect(out.user).toEqual({});
  });

  it("istek: çerez silinir, Cookie/Authorization başlığı maskelenir, query_string düşer", () => {
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
    const headers = req.headers as Record<string, unknown>;
    expect(headers.Cookie).toBe("[Filtered]");
    expect(headers.Authorization).toBe("[Filtered]");
    expect(headers["User-Agent"]).toBe("UA");
    expect(req.url).toBe("https://x.app/reset?token=[Filtered]");
    expect(req.query_string).toBe("[Filtered]");
    expect((req.data as Record<string, unknown>).body).toBe("[Filtered]");
    expect((req.data as Record<string, unknown>).ok).toBe("kalir");
  });

  it("extra ve breadcrumb'lar da temizlenir", () => {
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
    expect(crumbData.url).toBe("https://x.app/cb?code=[Filtered]");
    expect(crumbData.email).toBe("[Filtered]");
  });

  it("orijinal event'i mutasyona uğratmaz (kopya döndürür)", () => {
    const original = { user: { id: "1", email: "a@b.com" } };
    scrubEvent(original);
    expect(original.user.email).toBe("a@b.com");
  });
});

describe("scrubBreadcrumb — fetch/xhr izi", () => {
  it("data.url'deki token'ı ve e-postayı maskeler", () => {
    const out = scrubBreadcrumb({
      category: "fetch",
      data: { url: "https://x.app/api?token=zzz", email: "a@b.com" },
    });
    const data = out.data as Record<string, unknown>;
    expect(data.url).toBe("https://x.app/api?token=[Filtered]");
    expect(data.email).toBe("[Filtered]");
  });
});
