// src/lib/datetime.ts — ortak tarih/saat biçimlendirme, saat dilimi SABİT
// (Europe/Istanbul). #418 REGRESYON TESTİ: sunucu (Vercel/UTC) ve tarayıcı
// hangi dilimde olursa olsun ÇIKTI AYNI olmalı. Aşağıdaki `underTZ` yardımcısı
// process.env.TZ'yi çalışma anında değiştirir (Node bunu onurlandırır — bu
// makinede doğrulandı) ve her deterministik yardımcının iki farklı ana bilgisayar
// saat dilimi altında BİREBİR aynı sonucu verdiğini kanıtlar.
import { afterEach, describe, expect, it } from "vitest";
import {
  APP_TIME_ZONE,
  DAY_MS,
  appDateTimeFormat,
  appDayKey,
  appDayOfWeek,
  formatDateTime,
  fromAppDateTimeInput,
  startOfAppDay,
  toAppDateTimeInput,
} from "@/lib/datetime";

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

/** fn'i verilen ana bilgisayar saat dilimi altında çalıştırır. */
function underTZ<T>(tz: string, fn: () => T): T {
  process.env.TZ = tz;
  return fn();
}

/** Aynı çağrı UTC ve America/New_York altında BİREBİR aynı sonucu vermeli. */
function tzInvariant<T>(fn: () => T): T {
  const utc = underTZ("UTC", fn);
  const ny = underTZ("America/New_York", fn);
  expect(ny).toStrictEqual(utc);
  return utc;
}

describe("sabitler", () => {
  it("APP_TIME_ZONE Europe/Istanbul, DAY_MS 24 saat", () => {
    expect(APP_TIME_ZONE).toBe("Europe/Istanbul");
    expect(DAY_MS).toBe(86_400_000);
  });
});

describe("appDayKey (#418: TZ'den bağımsız takvim günü)", () => {
  it("09:00Z → aynı Istanbul günü", () => {
    expect(tzInvariant(() => appDayKey("2026-07-20T09:00:00Z"))).toBe(
      "2026-07-20",
    );
  });

  it("21:00Z → Istanbul'da ertesi gün (+3 sınırı)", () => {
    expect(tzInvariant(() => appDayKey("2026-07-20T21:00:00Z"))).toBe(
      "2026-07-21",
    );
  });

  it("20:59Z → hâlâ aynı gün", () => {
    expect(tzInvariant(() => appDayKey("2026-07-20T20:59:00Z"))).toBe(
      "2026-07-20",
    );
  });

  it("epoch (number) girdisiyle de tutarlı", () => {
    const ms = Date.parse("2026-07-20T21:00:00Z");
    expect(tzInvariant(() => appDayKey(ms))).toBe("2026-07-21");
  });
});

describe("startOfAppDay (Istanbul gece yarısı, gerçek an)", () => {
  it("gün içindeki herhangi an → Istanbul 00:00 (= 21:00Z önceki gün)", () => {
    const iso = tzInvariant(() =>
      startOfAppDay("2026-07-20T09:00:00Z").toISOString(),
    );
    expect(iso).toBe("2026-07-19T21:00:00.000Z");
  });

  it("Istanbul günü değişmemiş sürece aynı başlangıcı döner", () => {
    const a = startOfAppDay("2026-07-20T05:00:00Z").toISOString();
    const b = startOfAppDay("2026-07-20T18:00:00Z").toISOString();
    expect(a).toBe(b);
  });
});

describe("appDayOfWeek (Pazartesi=0 … Pazar=6)", () => {
  it("2026-07-20 Pazartesi → 0", () => {
    expect(tzInvariant(() => appDayOfWeek("2026-07-20T09:00:00Z"))).toBe(0);
  });

  it("2026-07-19 Pazar → 6", () => {
    expect(tzInvariant(() => appDayOfWeek("2026-07-19T09:00:00Z"))).toBe(6);
  });

  it("Pazar 21:30Z Istanbul'da Pazartesi'ye geçer → 0", () => {
    expect(tzInvariant(() => appDayOfWeek("2026-07-19T21:30:00Z"))).toBe(0);
  });
});

describe("toAppDateTimeInput (an → datetime-local, kampüs duvar saati)", () => {
  it("09:00Z → 12:00 (+3)", () => {
    expect(tzInvariant(() => toAppDateTimeInput("2026-07-20T09:00:00Z"))).toBe(
      "2026-07-20T12:00",
    );
  });

  it("gece yarısını aşan an ertesi güne taşar", () => {
    expect(tzInvariant(() => toAppDateTimeInput("2026-01-05T22:15:00Z"))).toBe(
      "2026-01-06T01:15",
    );
  });
});

describe("fromAppDateTimeInput (datetime-local kampüs saati → UTC ISO)", () => {
  it("12:00 (Istanbul) → 09:00Z", () => {
    expect(tzInvariant(() => fromAppDateTimeInput("2026-07-20T12:00"))).toBe(
      "2026-07-20T09:00:00.000Z",
    );
  });

  it("saniyeli girdiyi de kabul eder", () => {
    expect(tzInvariant(() => fromAppDateTimeInput("2026-07-20T12:00:30"))).toBe(
      "2026-07-20T09:00:30.000Z",
    );
  });

  it("toAppDateTimeInput ↔ fromAppDateTimeInput dakika hassasiyetinde round-trip", () => {
    const original = "2026-07-20T09:00:00.000Z";
    expect(fromAppDateTimeInput(toAppDateTimeInput(original))).toBe(original);
  });
});

describe("formatDateTime (yerelleştirilmiş, Istanbul dilimi)", () => {
  it("TZ'den bağımsız — UTC ve NY altında aynı metin (#418)", () => {
    const tr = tzInvariant(() =>
      formatDateTime("2026-07-20T09:00:00Z", "tr", "short"),
    );
    const en = tzInvariant(() =>
      formatDateTime("2026-07-20T09:00:00Z", "en", "short"),
    );
    // +3 kayması uygulanmış (09:00Z → 12:00 Istanbul); noktalama/AM-PM ICU
    // sürümüne göre değişebildiği için yalnız sabit parçalar doğrulanır.
    expect(tr).toContain("20 Tem 2026");
    expect(tr).toContain("12:00");
    expect(en).toContain("2026");
    expect(en).toContain("12:00");
  });

  it("stil anahtarları farklı ama tutarlı çıktı verir", () => {
    const short = formatDateTime("2026-07-20T09:00:00Z", "tr", "short");
    const long = formatDateTime("2026-07-20T09:00:00Z", "tr", "long");
    expect(short).toContain("Tem"); // kısa ay
    expect(long).toContain("Temmuz"); // uzun ay
  });
});

describe("appDateTimeFormat", () => {
  it("saat dilimini daima Istanbul'a sabitler", () => {
    const fmt = appDateTimeFormat("tr", { dateStyle: "short" });
    expect(fmt.resolvedOptions().timeZone).toBe("Europe/Istanbul");
  });
});
