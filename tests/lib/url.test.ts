// src/lib/url.ts — kullanıcı-girdisi harici URL'lerinin güvenli işlenmesi.
// React href'i sanitize ETMEZ; javascript:/data:/vbscript: şemalı bir URL
// tıklamada çalışır (stored XSS). safeExternalHref yalnız http(s)'i geçirir.
import { describe, expect, it } from "vitest";
import { isValidExternalUrl, safeExternalHref } from "@/lib/url";

describe("safeExternalHref — XSS şema saldırı vektörleri", () => {
  it("javascript: şemasını engeller", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBeNull();
    // Karışık büyük-küçük harf + gömülü sekme de engellenir (URL şemayı
    // normalize eder / boşlukları atar).
    expect(safeExternalHref("JavaScript:alert(1)")).toBeNull();
    expect(safeExternalHref("java\tscript:alert(1)")).toBeNull();
  });

  it("data: ve vbscript: şemalarını engeller", () => {
    expect(safeExternalHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalHref("vbscript:msgbox(1)")).toBeNull();
  });

  it("mailto: / tel: buradan GEÇMEZ (ayrı, kod-üretimli)", () => {
    expect(safeExternalHref("mailto:a@b.com")).toBeNull();
    expect(safeExternalHref("tel:+90555")).toBeNull();
  });

  it("ftp: gibi http-dışı şemayı engeller", () => {
    expect(safeExternalHref("ftp://files.example.com/x")).toBeNull();
  });

  it("protokol-göreli //evil.com geçersiz URL → null", () => {
    expect(safeExternalHref("//evil.com")).toBeNull();
  });
});

describe("safeExternalHref — geçerli http(s)", () => {
  it("http ve https'i normalize edip döner", () => {
    expect(safeExternalHref("http://example.com")).toBe("http://example.com/");
    expect(safeExternalHref("https://example.com/path?q=1")).toBe(
      "https://example.com/path?q=1",
    );
  });

  it("büyük harfli şema/host'u normalize eder", () => {
    expect(safeExternalHref("HTTP://EXAMPLE.COM")).toBe("http://example.com/");
  });

  it("çevresel boşlukları kırpar", () => {
    expect(safeExternalHref("  https://example.com  ")).toBe(
      "https://example.com/",
    );
  });

  it("boş / null / undefined / sadece-boşluk → null", () => {
    expect(safeExternalHref(null)).toBeNull();
    expect(safeExternalHref(undefined)).toBeNull();
    expect(safeExternalHref("")).toBeNull();
    expect(safeExternalHref("   ")).toBeNull();
  });

  it("şemasız 'example.com' geçersiz URL → null", () => {
    expect(safeExternalHref("example.com")).toBeNull();
  });

  // DAVRANIŞ KİLİDİ (güvenlik gözlemi — rapora bakın): şema süzgeci userinfo
  // tabanlı host aldatmasını (https://instagram.com@evil.com) ENGELLEMEZ.
  // Geçerli https sayıldığı için href döner; gerçek host evil.com'dur.
  it("userinfo host aldatması geçerli https sayılır (şema süzgeci kapsamaz)", () => {
    const href = safeExternalHref("https://instagram.com@evil.com");
    expect(href).not.toBeNull();
    expect(new URL(href!).host).toBe("evil.com");
  });
});

describe("isValidExternalUrl — form doğrulaması (opsiyonel alan)", () => {
  it("boş / sadece-boşluk geçerli (alan opsiyonel)", () => {
    expect(isValidExternalUrl("")).toBe(true);
    expect(isValidExternalUrl("   ")).toBe(true);
  });

  it("geçerli http(s) URL geçerli", () => {
    expect(isValidExternalUrl("https://instagram.com/metu")).toBe(true);
  });

  it("XSS şeması / bozuk URL geçersiz", () => {
    expect(isValidExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isValidExternalUrl("not a url")).toBe(false);
    expect(isValidExternalUrl("//evil.com")).toBe(false);
  });
});
