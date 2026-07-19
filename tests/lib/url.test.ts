// src/lib/url.ts — kullanıcı-girdisi harici URL'lerinin güvenli işlenmesi.
// React href'i sanitize ETMEZ; javascript:/data:/vbscript: şemalı bir URL
// tıklamada çalışır (stored XSS). Ayrıca şema süzgeci TEK BAŞINA yetmez:
// userinfo aldatması (https://instagram.com@evil.com) geçerli https'tir ama
// gerçek host evil.com'dur. safeExternalHref PARSE edip GERÇEK hostname'i bir
// allow-list'e (instagram/whatsapp/metu — DB is_safe_notification_link ile aynı
// küme) göre doğrular ve userinfo/port taşıyan URL'leri reddeder.
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

  it("ftp: gibi http-dışı şemayı engeller (izinli host olsa bile)", () => {
    expect(safeExternalHref("ftp://instagram.com/x")).toBeNull();
  });

  it("http (https değil) reddedilir — allow-list kuralı https'tir", () => {
    expect(safeExternalHref("http://instagram.com/x")).toBeNull();
  });

  it("protokol-göreli //evil.com geçersiz URL → null", () => {
    expect(safeExternalHref("//evil.com")).toBeNull();
  });
});

describe("safeExternalHref — userinfo/host aldatma vektörleri (HEPSİ reddedilir)", () => {
  // Bunlar canlı QA / test turunun bulduğu phishing vektörleridir; artık
  // DOĞRU davranış kilitli: gerçek host allow-list dışıysa VEYA userinfo/port
  // taşıyorsa null döner.
  it("userinfo ile gizlenmiş gerçek host (instagram.com@evil.com)", () => {
    expect(safeExternalHref("https://instagram.com@evil.com")).toBeNull();
  });

  it("userinfo + port (instagram.com:8080@evil.com)", () => {
    expect(safeExternalHref("https://instagram.com:8080@evil.com")).toBeNull();
  });

  it("izinli host'un alt-alan gibi görünen sahte kökü (instagram.com.evil.com)", () => {
    expect(safeExternalHref("https://instagram.com.evil.com")).toBeNull();
  });

  it("izinli host yalnız fragment'te (evil.com#instagram.com)", () => {
    expect(safeExternalHref("https://evil.com#instagram.com")).toBeNull();
  });

  it("izinli host yalnız query'de (evil.com/?x=instagram.com)", () => {
    expect(safeExternalHref("https://evil.com/?x=instagram.com")).toBeNull();
  });

  it("gerçek host izinli ama userinfo taşıyor (evil.com@instagram.com) → yine red", () => {
    // Savunma derinliği: host izinli olsa bile userinfo varsa reddedilir.
    expect(safeExternalHref("https://evil.com@instagram.com")).toBeNull();
  });

  it("açık (varsayılan-dışı) port reddedilir (instagram.com:8080)", () => {
    expect(safeExternalHref("https://instagram.com:8080/x")).toBeNull();
  });

  it("izin dışı düz host reddedilir (example.com)", () => {
    expect(safeExternalHref("https://example.com/path?q=1")).toBeNull();
  });
});

describe("safeExternalHref — izinli host'lar (instagram/whatsapp/metu)", () => {
  it("instagram / whatsapp host'larını normalize edip döner", () => {
    expect(safeExternalHref("https://instagram.com/metuclub")).toBe(
      "https://instagram.com/metuclub",
    );
    expect(safeExternalHref("https://www.instagram.com/x")).toBe(
      "https://www.instagram.com/x",
    );
    expect(safeExternalHref("https://wa.me/905551234567")).toBe(
      "https://wa.me/905551234567",
    );
    expect(safeExternalHref("https://chat.whatsapp.com/ABC123")).toBe(
      "https://chat.whatsapp.com/ABC123",
    );
  });

  it("metu.edu.tr ve alt alanları izinli", () => {
    expect(safeExternalHref("https://metu.edu.tr")).toBe("https://metu.edu.tr/");
    expect(safeExternalHref("https://cs.metu.edu.tr/club")).toBe(
      "https://cs.metu.edu.tr/club",
    );
  });

  it("büyük harfli şema/host normalize edilir; varsayılan :443 elenir", () => {
    expect(safeExternalHref("HTTPS://INSTAGRAM.COM/x")).toBe(
      "https://instagram.com/x",
    );
    expect(safeExternalHref("https://instagram.com:443/x")).toBe(
      "https://instagram.com/x",
    );
  });

  it("çevresel boşlukları kırpar", () => {
    expect(safeExternalHref("  https://instagram.com/x  ")).toBe(
      "https://instagram.com/x",
    );
  });

  it("boş / null / undefined / sadece-boşluk / şemasız → null", () => {
    expect(safeExternalHref(null)).toBeNull();
    expect(safeExternalHref(undefined)).toBeNull();
    expect(safeExternalHref("")).toBeNull();
    expect(safeExternalHref("   ")).toBeNull();
    expect(safeExternalHref("instagram.com")).toBeNull(); // şemasız → geçersiz URL
  });
});

describe("isValidExternalUrl — form doğrulaması (opsiyonel alan)", () => {
  it("boş / sadece-boşluk geçerli (alan opsiyonel)", () => {
    expect(isValidExternalUrl("")).toBe(true);
    expect(isValidExternalUrl("   ")).toBe(true);
  });

  it("izinli host geçerli", () => {
    expect(isValidExternalUrl("https://instagram.com/metu")).toBe(true);
    expect(isValidExternalUrl("https://wa.me/9055")).toBe(true);
  });

  it("XSS şeması / bozuk URL / izin dışı host / userinfo aldatması geçersiz", () => {
    expect(isValidExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isValidExternalUrl("not a url")).toBe(false);
    expect(isValidExternalUrl("//evil.com")).toBe(false);
    expect(isValidExternalUrl("https://evil.com")).toBe(false);
    expect(isValidExternalUrl("https://instagram.com@evil.com")).toBe(false);
  });
});
