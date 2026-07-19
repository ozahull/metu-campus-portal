// src/lib/known-errors.ts — ham DB/RPC hata metnini i18n alt anahtarına eşler;
// eşleşmeyen her şey null'a düşer (çağıran genel mesaja çevirir, ham metin
// asla kullanıcıya basılmaz).
import { describe, expect, it } from "vitest";
import { knownErrorKey, type KnownErrorPatterns } from "@/lib/known-errors";

const PATTERNS: KnownErrorPatterns = [
  ["Çok hızlı mesaj", "sendRateLimit"],
  ["kapasite", "capacityFull"],
  ["yetki", "unauthorized"],
];

describe("knownErrorKey", () => {
  it("bilinen alt dizeyi anahtara çevirir", () => {
    expect(
      knownErrorKey("Çok hızlı mesaj gönderiyorsunuz", PATTERNS),
    ).toBe("sendRateLimit");
    expect(knownErrorKey("Etkinlik kapasitesi dolu", PATTERNS)).toBe(
      "capacityFull",
    );
  });

  it("eşleşmeyen mesaj → null (genel mesaja düşer)", () => {
    expect(knownErrorKey("beklenmeyen bir şey oldu", PATTERNS)).toBeNull();
  });

  it("boş / null / undefined mesaj → null", () => {
    expect(knownErrorKey("", PATTERNS)).toBeNull();
    expect(knownErrorKey(null, PATTERNS)).toBeNull();
    expect(knownErrorKey(undefined, PATTERNS)).toBeNull();
  });

  it("sıra önceliktir — ilk eşleşen kalıp kazanır", () => {
    const patterns: KnownErrorPatterns = [
      ["hata", "generic"],
      ["kapasite hata", "specific"],
    ];
    // "kapasite hata" iki kalıba da uyar; dizideki İLK ("hata") kazanır.
    expect(knownErrorKey("kapasite hata mesajı", patterns)).toBe("generic");
  });

  it("büyük-küçük harfe duyarlıdır (includes)", () => {
    expect(knownErrorKey("ÇOK HIZLI MESAJ", PATTERNS)).toBeNull();
  });

  it("boş kalıp listesi → null", () => {
    expect(knownErrorKey("herhangi bir hata", [])).toBeNull();
  });
});
