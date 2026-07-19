// src/lib/authz.ts — görünürlük/yetki türetmeleri (GÖSTERİM bayrakları; gerçek
// yetki RLS+RPC'de). can_edit / can_write NULL tuzağı bu ailedendi.
import { describe, expect, it } from "vitest";
import {
  canManageClub,
  isClubPresidentRole,
  isSameUser,
  rpcGrant,
} from "@/lib/authz";

describe("isClubPresidentRole (club_members.role === 'ADMIN')", () => {
  it("ADMIN → true (büyük-küçük harf duyarsız)", () => {
    expect(isClubPresidentRole("ADMIN")).toBe(true);
    expect(isClubPresidentRole("admin")).toBe(true);
  });

  it("MEMBER / null / undefined / boş → false", () => {
    expect(isClubPresidentRole("MEMBER")).toBe(false);
    expect(isClubPresidentRole(null)).toBe(false);
    expect(isClubPresidentRole(undefined)).toBe(false);
    expect(isClubPresidentRole("")).toBe(false);
  });

  it("club_members.role alanında bulunmayan değerler (PRESIDENT dahil) → false", () => {
    // Bu fonksiyonun etki alanı club_members.role'dur; orada yalnız MEMBER/ADMIN
    // vardır. 'PRESIDENT' okul/RPC terminolojisidir, burada eşleşmez.
    expect(isClubPresidentRole("PRESIDENT")).toBe(false);
  });

  it("trim UYGULANMAZ (özgün davranışla birebir; DB değeri zaten paddingsiz)", () => {
    expect(isClubPresidentRole(" ADMIN ")).toBe(false);
  });
});

describe("canManageClub (okul VEYA danışman VEYA başkan)", () => {
  const F = { isSuperAdmin: false, isClubAdvisor: false, isClubPresident: false };

  it("herhangi biri true → yönetebilir", () => {
    expect(canManageClub({ ...F, isSuperAdmin: true })).toBe(true);
    expect(canManageClub({ ...F, isClubAdvisor: true })).toBe(true);
    expect(canManageClub({ ...F, isClubPresident: true })).toBe(true);
  });

  it("hepsi false → yönetemez", () => {
    expect(canManageClub(F)).toBe(false);
  });

  it("hepsi true → yönetebilir", () => {
    expect(
      canManageClub({
        isSuperAdmin: true,
        isClubAdvisor: true,
        isClubPresident: true,
      }),
    ).toBe(true);
  });
});

describe("rpcGrant (NULL'lanabilir RPC bayrağı — NULL tuzağı guard'ı)", () => {
  it("YALNIZ gerçek boolean true yetki verir", () => {
    expect(rpcGrant(true)).toBe(true);
  });

  it("NULL / undefined / false → yetki YOK (RPC auth bağlamı taşınamazsa NULL döner)", () => {
    expect(rpcGrant(null)).toBe(false);
    expect(rpcGrant(undefined)).toBe(false);
    expect(rpcGrant(false)).toBe(false);
  });

  it("truthy ama boolean-olmayan değerler yetki VERMEZ (=== true, sadece güvenilir tip)", () => {
    expect(rpcGrant("true")).toBe(false);
    expect(rpcGrant(1)).toBe(false);
    expect(rpcGrant({})).toBe(false);
  });
});

describe("isSameUser (isSelf oturumdan; null===null tuzağı kapalı)", () => {
  it("aynı kimlik → true", () => {
    expect(isSameUser("user-1", "user-1")).toBe(true);
  });

  it("farklı kimlik → false", () => {
    expect(isSameUser("user-1", "user-2")).toBe(false);
  });

  it("nullish girdi ASLA self saymaz (can_edit NULL asimetrisi regresyonu)", () => {
    expect(isSameUser(null, null)).toBe(false);
    expect(isSameUser("user-1", null)).toBe(false);
    expect(isSameUser(undefined, "user-1")).toBe(false);
    expect(isSameUser("", "")).toBe(false);
  });
});
