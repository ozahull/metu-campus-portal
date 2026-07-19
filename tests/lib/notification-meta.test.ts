// src/lib/notification-meta.ts — bildirim linki güvenli yönlendirme.
// isSafeInternalPath: router.push YALNIZ güvenli uygulama-içi yola gitmeli;
// '//evil.com' (protokol-göreli) ve '/\evil.com' (ters bölü) reddedilir.
import { describe, expect, it } from "vitest";
import { isExternalLink, isSafeInternalPath } from "@/lib/notification-meta";

describe("isExternalLink", () => {
  it("http(s) linkleri harici sayar (yeni sekme)", () => {
    expect(isExternalLink("https://example.com")).toBe(true);
    expect(isExternalLink("http://example.com")).toBe(true);
    expect(isExternalLink("HTTPS://EXAMPLE.COM")).toBe(true); // i bayrağı
  });

  it("uygulama-içi yol / null / boş → harici değil", () => {
    expect(isExternalLink("/clubs/1")).toBe(false);
    expect(isExternalLink("//evil.com")).toBe(false); // http öneki yok
    expect(isExternalLink(null)).toBe(false);
    expect(isExternalLink("")).toBe(false);
  });
});

describe("isSafeInternalPath — açık yönlendirme koruması", () => {
  it("tek '/' ile başlayan yolu kabul eder", () => {
    expect(isSafeInternalPath("/clubs/1")).toBe(true);
    expect(isSafeInternalPath("/messages/abc-123")).toBe(true);
    expect(isSafeInternalPath("/")).toBe(true);
  });

  it("'//evil.com' protokol-göreli kaçışı reddeder", () => {
    expect(isSafeInternalPath("//evil.com")).toBe(false);
  });

  it("'/\\evil.com' ters-bölü kaçışını reddeder", () => {
    // Tarayıcılar '/\' ikilisini '//' gibi yorumlar → dış host'a kaçış.
    expect(isSafeInternalPath("/\\evil.com")).toBe(false);
  });

  it("mutlak http(s) URL güvenli-iç yol DEĞİLDİR", () => {
    expect(isSafeInternalPath("https://evil.com")).toBe(false);
  });

  it("baştaki '/' olmayan yol reddedilir", () => {
    expect(isSafeInternalPath("clubs/1")).toBe(false);
  });

  it("null / boş → false", () => {
    expect(isSafeInternalPath(null)).toBe(false);
    expect(isSafeInternalPath("")).toBe(false);
  });

  it("ne harici ne güvenli-iç olan link her iki testte de reddedilir", () => {
    // Böyle bir link'te GEZİNME YAPILMAZ (çağıranın sözleşmesi).
    for (const link of ["javascript:alert(1)", "//evil.com", "mailto:a@b.com"]) {
      expect(isExternalLink(link) || isSafeInternalPath(link)).toBe(false);
    }
  });
});
