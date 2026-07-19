// src/lib/category.ts — serbest-metin kategoriyi bilinen değerlerde i18n'e
// çevirir; bilinmeyeni olduğu gibi gösterir. Eşleşme HAM değerle değil, çift
// küçük-harf araması (tr + standart) ile yapılır.
import { describe, expect, it } from "vitest";
import { categoryLabel } from "@/lib/category";

// Çevirici anahtarı olduğu gibi döndürür → hangi categories.* anahtarının
// seçildiğini doğrulayabiliriz.
const t = (k: string) => `cat:${k}`;

describe("categoryLabel", () => {
  it("Türkçe bilinen değeri anahtara çevirir", () => {
    expect(categoryLabel("Teknoloji", t)).toBe("cat:technology");
    expect(categoryLabel("Spor", t)).toBe("cat:sports");
    expect(categoryLabel("Sanat", t)).toBe("cat:arts");
  });

  it("İngilizce bilinen değeri de çevirir", () => {
    expect(categoryLabel("technology", t)).toBe("cat:technology");
    expect(categoryLabel("gaming", t)).toBe("cat:games");
    expect(categoryLabel("theater", t)).toBe("cat:theatre");
  });

  it("Türkçe büyük harf küçültme tuzağını aşar (MÜZİK → music)", () => {
    // 'MÜZİK'.toLowerCase() = 'müzi̇k' (combining dot) sözlüğe UYMAZ; tr-locale
    // küçültme 'müzik' verir ve eşleşir.
    expect(categoryLabel("MÜZİK", t)).toBe("cat:music");
  });

  it("çevresel boşlukları kırpar", () => {
    expect(categoryLabel("  spor  ", t)).toBe("cat:sports");
  });

  it("Türkçe karakterli bilinen değer (Fotoğrafçılık)", () => {
    expect(categoryLabel("Fotoğrafçılık", t)).toBe("cat:photography");
  });

  it("bilinmeyen değeri (kırpılmış) HAM haliyle döner — çeviriden geçmez", () => {
    expect(categoryLabel("Yürüyüş", t)).toBe("Yürüyüş");
    expect(categoryLabel("  Deneysel  ", t)).toBe("Deneysel");
  });

  it("null / undefined / boş → null", () => {
    expect(categoryLabel(null, t)).toBeNull();
    expect(categoryLabel(undefined, t)).toBeNull();
    expect(categoryLabel("", t)).toBeNull();
  });
});
