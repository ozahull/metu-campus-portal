// src/lib/name-from-email.ts — e-postadan gerçek-ad türetme + doğrulama.
// Kurumsal ODTÜ e-postaları ad.soyad#### formatında; gerçek ad türetilebilir
// ve girilen ad e-posta ile eşleşmeye zorlanır ("sahte ad" elenir).
import { describe, expect, it } from "vitest";
import {
  deriveNameFromEmail,
  isDerivableEmail,
  nameMatchesEmail,
  normalizeNameToken,
} from "@/lib/name-from-email";

describe("normalizeNameToken", () => {
  it("boşluk/nokta/rakamı atıp yalnız a-z bırakır", () => {
    expect(normalizeNameToken("Onur Esen")).toBe("onuresen");
    expect(normalizeNameToken("onur.esen2005")).toBe("onuresen");
  });

  it("Türkçe harfleri ASCII'ye indirger (I/ı tuzağı)", () => {
    // "IŞIK" ve "ışık" AYNI kanonik token'a inmeli (Türkçe klavye eşleşmesi).
    expect(normalizeNameToken("IŞIK")).toBe("isik");
    expect(normalizeNameToken("ışık")).toBe("isik");
    // "İnovasyon" — noktalı İ combining-dot tuzağına düşmeden "i"ye iner.
    expect(normalizeNameToken("İnovasyon")).toBe("inovasyon");
    expect(normalizeNameToken("Gülçin")).toBe("gulcin");
  });

  it("boş/yalnız-sembol girdide boş token", () => {
    expect(normalizeNameToken("")).toBe("");
    expect(normalizeNameToken("123 .-")).toBe("");
  });
});

describe("deriveNameFromEmail", () => {
  it("ad.soyad#### → { first, last }", () => {
    expect(deriveNameFromEmail("onur.esen2005@metu.edu.tr")).toEqual({
      first: "Onur",
      last: "Esen",
    });
  });

  it("çok parçalı soyadı birleştirir", () => {
    expect(deriveNameFromEmail("ali.veli.kaya@metu.edu.tr")).toEqual({
      first: "Ali",
      last: "Veli Kaya",
    });
  });

  it("Türkçe-duyarlı title case uygular (i → İ)", () => {
    // titleCase toLocaleUpperCase('tr') kullanır: "irem" → "İrem".
    expect(deriveNameFromEmail("irem.isik@metu.edu.tr")).toEqual({
      first: "İrem",
      last: "İsik",
    });
  });

  it("tek kelime (nokta yok) → null", () => {
    expect(deriveNameFromEmail("onur@metu.edu.tr")).toBeNull();
  });

  it("boş / geçersiz → null", () => {
    expect(deriveNameFromEmail("")).toBeNull();
    expect(deriveNameFromEmail("@metu.edu.tr")).toBeNull();
    // "onur." → split noktadan sonra boş parça eler → tek parça → null.
    expect(deriveNameFromEmail("onur.@metu.edu.tr")).toBeNull();
  });

  it("sondaki rakamları atar ama aradaki noktayı korur", () => {
    expect(deriveNameFromEmail("mehmet.oz42@ncc.metu.edu.tr")).toEqual({
      first: "Mehmet",
      last: "Oz",
    });
  });
});

describe("isDerivableEmail", () => {
  it("nokta içeren yerel (rakamsız) → true", () => {
    expect(isDerivableEmail("onur.esen2005@metu.edu.tr")).toBe(true);
    expect(isDerivableEmail("ali.veli.kaya@metu.edu.tr")).toBe(true);
  });

  it("tek kelime yerel → false", () => {
    expect(isDerivableEmail("onur@metu.edu.tr")).toBe(false);
    expect(isDerivableEmail("onur2005@metu.edu.tr")).toBe(false);
  });

  it("boş / sadece rakam yerel → false", () => {
    expect(isDerivableEmail("")).toBe(false);
    expect(isDerivableEmail("2005@metu.edu.tr")).toBe(false);
  });
});

describe("nameMatchesEmail", () => {
  it("türetilen ada eşleşen girdiyi kabul eder", () => {
    expect(nameMatchesEmail("Onur Esen", "onur.esen2005@metu.edu.tr")).toBe(
      true,
    );
    // rakamsız e-posta da aynı token → eşleşir.
    expect(nameMatchesEmail("Onur Esen", "onur.esen@metu.edu.tr")).toBe(true);
  });

  it("Türkçe düzeltmeye izin verir (Eşen ↔ esen)", () => {
    expect(nameMatchesEmail("Onur Eşen", "onur.esen@metu.edu.tr")).toBe(true);
  });

  it("sahte adı reddeder", () => {
    expect(nameMatchesEmail("Test Hocam", "onur.esen@metu.edu.tr")).toBe(false);
  });

  it("ad-soyad sırasına duyarlıdır", () => {
    expect(nameMatchesEmail("Esen Onur", "onur.esen@metu.edu.tr")).toBe(false);
  });

  it("token boşsa (yalnız rakam yerel) daima false", () => {
    expect(nameMatchesEmail("", "2005@metu.edu.tr")).toBe(false);
  });
});
