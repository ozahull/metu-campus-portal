// src/lib/ticket-classify.ts — bilet sınıflandırma (aktif/geçmiş). Kritik iş
// kuralı: CHECKED_IN her zaman GEÇMİŞ'tir (etkinlik gelecekte olsa bile);
// AKTİF yalnız APPROVED + başlamamış. tickets/page.tsx'ten çıkarıldı.
import { describe, expect, it } from "vitest";
import { classifyTicket } from "@/lib/ticket-classify";

const NOW = 1_700_000_000_000; // sabit referans an (test determinizmi)
const FUTURE = NOW + 60_000;
const PAST = NOW - 60_000;

describe("classifyTicket", () => {
  it("APPROVED + gelecek → AKTİF (iptal edilebilir)", () => {
    expect(classifyTicket({ status: "APPROVED", eventDateMs: FUTURE, now: NOW }))
      .toEqual({ checkedIn: false, active: true, expired: false });
  });

  it("APPROVED + geçmiş → GEÇMİŞ + 'geçti' damgası", () => {
    expect(classifyTicket({ status: "APPROVED", eventDateMs: PAST, now: NOW }))
      .toEqual({ checkedIn: false, active: false, expired: true });
  });

  it("sınır: etkinlik TAM şu an başlıyorsa başlamış (started = date <= now) → geçmiş", () => {
    expect(classifyTicket({ status: "APPROVED", eventDateMs: NOW, now: NOW }))
      .toEqual({ checkedIn: false, active: false, expired: true });
  });

  it("CHECKED_IN + gelecek → GEÇMİŞ, 'girildi' damgası ('geçti' DEĞİL)", () => {
    // KRİTİK KURAL: girilmiş bilet, etkinlik gelecekte olsa bile aktif değildir
    // ve expired=false (damga 'girildi' > 'geçti').
    expect(classifyTicket({ status: "CHECKED_IN", eventDateMs: FUTURE, now: NOW }))
      .toEqual({ checkedIn: true, active: false, expired: false });
  });

  it("CHECKED_IN + geçmiş → GEÇMİŞ, yine 'girildi' damgası (expired bastırılır)", () => {
    expect(classifyTicket({ status: "CHECKED_IN", eventDateMs: PAST, now: NOW }))
      .toEqual({ checkedIn: true, active: false, expired: false });
  });

  it("APPROVED dışı bir durum (ör. REJECTED) hiçbir zaman aktif değildir", () => {
    // active yalnız APPROVED'a bağlıdır; gelecekte olsa bile aktif olmaz.
    expect(classifyTicket({ status: "REJECTED", eventDateMs: FUTURE, now: NOW }))
      .toEqual({ checkedIn: false, active: false, expired: false });
  });

  it("sınır: 1ms gelecek aktif, 1ms geçmiş değil", () => {
    expect(
      classifyTicket({ status: "APPROVED", eventDateMs: NOW + 1, now: NOW }).active,
    ).toBe(true);
    expect(
      classifyTicket({ status: "APPROVED", eventDateMs: NOW - 1, now: NOW }).active,
    ).toBe(false);
  });
});
