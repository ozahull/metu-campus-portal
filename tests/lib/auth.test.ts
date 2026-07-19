// src/lib/auth.ts — kurumsal e-posta alan-adı kısıtı (frontend katmanı).
// Yalnız @metu.edu.tr ve @ncc.metu.edu.tr kabul edilir; "@" çapası benzer
// alan adı aldatmalarını (fake-metu.edu.tr, alt alan) eler.
import { describe, expect, it } from "vitest";
import { ALLOWED_DOMAINS, isAllowedEmail } from "@/lib/auth";

describe("ALLOWED_DOMAINS", () => {
  it("iki kurumsal alan adını içerir", () => {
    expect(ALLOWED_DOMAINS).toEqual(["@metu.edu.tr", "@ncc.metu.edu.tr"]);
  });
});

describe("isAllowedEmail", () => {
  it("izinli alan adlarını kabul eder", () => {
    expect(isAllowedEmail("onur.esen@metu.edu.tr")).toBe(true);
    expect(isAllowedEmail("ayse@ncc.metu.edu.tr")).toBe(true);
  });

  it("büyük harf ve çevresel boşluğa duyarsız", () => {
    expect(isAllowedEmail("  Onur.Esen@METU.EDU.TR ")).toBe(true);
  });

  it("izinsiz alan adlarını reddeder", () => {
    expect(isAllowedEmail("a@gmail.com")).toBe(false);
    expect(isAllowedEmail("a@metu.edu.com")).toBe(false);
  });

  it("'@' çapası benzer alan aldatmasını eler", () => {
    // "@metu.edu.tr" son ekinin hemen öncesinde '@' gerekir.
    expect(isAllowedEmail("a@fake-metu.edu.tr")).toBe(false);
    expect(isAllowedEmail("a@metu.edu.tr.evil.com")).toBe(false);
    // ncc dışı alt alan adları da reddedilir (yalnız kök + ncc izinli).
    expect(isAllowedEmail("a@sub.metu.edu.tr")).toBe(false);
  });
});
