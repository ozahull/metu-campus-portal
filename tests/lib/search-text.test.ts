// src/lib/search-text.ts — istemci-içi arama/filtre için Türkçe-güvenli
// normalizasyon. Düz toLowerCase() Türkçe I/ı tuzağına düşer; buradaki
// normalize hem sorguyu hem hedefi aynı ASCII kanonik biçime indirir.
import { describe, expect, it } from "vitest";
import { normalizeSearchText, searchIncludes } from "@/lib/search-text";

describe("normalizeSearchText", () => {
  it("null/undefined → boş dize", () => {
    expect(normalizeSearchText(null)).toBe("");
    expect(normalizeSearchText(undefined)).toBe("");
  });

  it("düz metni küçük harfe indirir", () => {
    expect(normalizeSearchText("Merhaba")).toBe("merhaba");
  });

  it("Türkçe harfleri ASCII'ye indirir (İ/ı/ş/ğ/ü/ö/ç)", () => {
    expect(normalizeSearchText("İnovasyon")).toBe("inovasyon");
    expect(normalizeSearchText("Gülçin")).toBe("gulcin");
    expect(normalizeSearchText("Yürüyüş")).toBe("yuruyus");
    expect(normalizeSearchText("Doğa")).toBe("doga");
    expect(normalizeSearchText("Çağrı")).toBe("cagri");
  });

  it("büyük İ ve büyük Ş noktalı-i tuzağına düşmez", () => {
    // "IŞIK" ve Türkçe klavye "ışık" AYNI kanonik biçime iner.
    expect(normalizeSearchText("IŞIK")).toBe("isik");
    expect(normalizeSearchText("ışık")).toBe("isik");
  });

  it("rakam ve boşlukları korur", () => {
    expect(normalizeSearchText("Kulüp 42")).toBe("kulup 42");
  });

  it("aksanlı Latin harfleri de indirir (â/î/û)", () => {
    expect(normalizeSearchText("Hâkim")).toBe("hakim");
  });
});

describe("searchIncludes", () => {
  it("normalize edilmiş sorguyu hedefte bulur", () => {
    // sorgu çağıran tarafta bir kez normalize edilir.
    const q = normalizeSearchText("Topluluğu");
    expect(searchIncludes("Bilim Topluluğu", q)).toBe(true);
  });

  it("ASCII klavyeyle yazılmış sorgu Türkçe metni bulur", () => {
    const q = normalizeSearchText("isik"); // "isik"
    expect(searchIncludes("Işık Kulübü", q)).toBe(true);
  });

  it("Türkçe klavyeyle yazılmış sorgu ASCII metni bulur", () => {
    const q = normalizeSearchText("müzik");
    expect(searchIncludes("Muzik Kulubu", q)).toBe(true);
  });

  it("eşleşmeyen sorgu için false", () => {
    const q = normalizeSearchText("spor");
    expect(searchIncludes("Bilim Topluluğu", q)).toBe(false);
  });

  it("null/undefined hedef güvenle false döner", () => {
    const q = normalizeSearchText("x");
    expect(searchIncludes(null, q)).toBe(false);
    expect(searchIncludes(undefined, q)).toBe(false);
  });

  it("boş sorgu her hedefte bulunur (includes('') === true)", () => {
    expect(searchIncludes("herhangi", "")).toBe(true);
  });
});
