// src/lib/role-label.ts — merkezî rol etiketi. Farklı kaynaklardan gelen ham
// rol/ilişki değerleri (profiles.role, club_members.role, RPC ilişkileri) tek
// bir roleLabels anahtar kümesine normalize edilir.
import { describe, expect, it } from "vitest";
import { roleLabel, roleLabelKey } from "@/lib/role-label";

describe("roleLabelKey", () => {
  it("okul rollerini eşler", () => {
    expect(roleLabelKey("SUPER_ADMIN")).toBe("superAdmin");
    expect(roleLabelKey("ADVISOR")).toBe("advisor");
  });

  it("kulüp başkanı: ADMIN ve PRESIDENT → president", () => {
    // club_members.role='ADMIN' başkandır; RPC ilişkisi 'PRESIDENT' de aynı.
    expect(roleLabelKey("ADMIN")).toBe("president");
    expect(roleLabelKey("PRESIDENT")).toBe("president");
  });

  it("USER / MEMBER / bilinmeyen → member (varsayılan)", () => {
    expect(roleLabelKey("USER")).toBe("member");
    expect(roleLabelKey("MEMBER")).toBe("member");
    expect(roleLabelKey("student")).toBe("member");
    expect(roleLabelKey("random-value")).toBe("member");
  });

  it("null / undefined / boş → member", () => {
    expect(roleLabelKey(null)).toBe("member");
    expect(roleLabelKey(undefined)).toBe("member");
    expect(roleLabelKey("")).toBe("member");
  });

  it("büyük-küçük harf ve boşluğa duyarsız", () => {
    expect(roleLabelKey("super_admin")).toBe("superAdmin");
    expect(roleLabelKey("  advisor  ")).toBe("advisor");
    expect(roleLabelKey("Admin")).toBe("president");
  });
});

describe("roleLabel", () => {
  it("normalize edilmiş anahtarla çeviriciyi çağırır", () => {
    const t = (k: "superAdmin" | "advisor" | "president" | "member") =>
      `label:${k}`;
    expect(roleLabel("SUPER_ADMIN", t)).toBe("label:superAdmin");
    expect(roleLabel("ADMIN", t)).toBe("label:president");
    expect(roleLabel(null, t)).toBe("label:member");
  });
});
