// src/lib/messaging.ts — kanal tipi TÜKETİMİ (ikon/başlık/alt satır). Kanal
// tipinin (ADMIN_ADVISOR/ADVISOR_PRESIDENT/ADMIN_PRESIDENT) HANGİ rol çiftinden
// türediği ve TEK-YÖN yazma kuralı ("hangi rol hangi kanalda yazabilir")
// SUNUCU tarafındadır (open_conversation / can_write_conversation RPC + RLS) —
// kapsam dışı (bkz. rapor). İstemci-tarafı yazma guard'ı authz.rpcGrant ile
// test edilir. Burada tipin GÖRSEL/METİN türetmeleri doğrulanır.
import { GraduationCap, Landmark, Users } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  conversationIcon,
  conversationSubtitle,
  counterpartText,
} from "@/lib/messaging";

describe("conversationIcon (kanal tipi → ikon)", () => {
  it("üç bilinen kanal tipini doğru ikona eşler", () => {
    expect(conversationIcon("ADMIN_ADVISOR")).toBe(GraduationCap);
    expect(conversationIcon("ADVISOR_PRESIDENT")).toBe(Users);
    expect(conversationIcon("ADMIN_PRESIDENT")).toBe(Landmark);
  });

  it("bilinmeyen tip → varsayılan (Users)", () => {
    expect(conversationIcon("UNKNOWN_TYPE")).toBe(Users);
    expect(conversationIcon("")).toBe(Users);
  });
});

describe("counterpartText (karşı taraf etiketi)", () => {
  const t = (k: string) => `msg:${k}`;
  const tRole = (k: string) => `role:${k}`;

  it("null → null", () => {
    expect(counterpartText(null, t, tRole)).toBeNull();
  });

  it("SCHOOL_ADMIN → messages.counterpart etiketine gider", () => {
    expect(counterpartText("SCHOOL_ADMIN", t, tRole)).toBe(
      "msg:counterpart.SCHOOL_ADMIN",
    );
  });

  it("rol token'ları (ADVISOR/PRESIDENT) merkezî roleLabel'a gider", () => {
    expect(counterpartText("ADVISOR", t, tRole)).toBe("role:advisor");
    expect(counterpartText("PRESIDENT", t, tRole)).toBe("role:president");
  });

  it("kişi adı (VERİ) olduğu gibi döner — çeviriye tabi değil", () => {
    expect(counterpartText("Ayşe Yılmaz", t, tRole)).toBe("Ayşe Yılmaz");
  });
});

describe("conversationSubtitle (alt satır)", () => {
  const t = (k: string) => `msg:${k}`;

  it("kulüp kanalında kulüp adı öncelikli", () => {
    expect(
      conversationSubtitle(
        { club_name: "Bilim Kulübü", type: "ADMIN_PRESIDENT" },
        t,
      ),
    ).toBe("Bilim Kulübü");
  });

  it("kulüp adı yoksa kanal tipinin etiketi", () => {
    expect(
      conversationSubtitle({ club_name: null, type: "ADMIN_ADVISOR" }, t),
    ).toBe("msg:channelType.ADMIN_ADVISOR");
  });
});
