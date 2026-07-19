// i18n parite koruması (test(i18n)). Anahtarlar defalarca eklendi/silindi ve
// parite sessizce bozulabiliyordu. Bu test her koşuda:
//   1) tr ve en anahtar kümelerinin BİREBİR aynı olduğunu (fark varsa hangi
//      anahtarlar — çıktıda görünür),
//   2) hiçbir çevirinin boş olmadığını,
//   3) ICU/interpolasyon içeren her değerin GEÇERLİ sözdizimine sahip olduğunu
//      (next-intl'in kullandığı @formatjs parser'ı ile), ve
//   4) ortak anahtarlarda interpolasyon değişken ADLARININ eşleştiğini
//      (tr {count} ↔ en {count}; biri {sayı} yazarsa çalışma anında patlar)
// doğrular. Türkçe'nin ICU-plural KULLANMAMASI (yalnız {count}) bir hata
// DEĞİLDİR — değişken adı aynı kaldığı sürece parite korunur.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parse,
  TYPE,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";

function loadMessages(file: string): unknown {
  const path = fileURLToPath(new URL(`../../messages/${file}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8"));
}

/** İç içe mesaj nesnesini nokta-yollu yaprak haritasına indirger. */
function flatten(
  obj: unknown,
  prefix = "",
  out = new Map<string, unknown>(),
): Map<string, unknown> {
  if (obj === null || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object") flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}

/** ICU AST'inden tüm interpolasyon değişken adlarını toplar (plural/select/tag
 *  seçeneklerine ve alt öğelerine iner; '#' pound ve düz metin arg değildir). */
function collectArgs(
  els: MessageFormatElement[],
  acc = new Set<string>(),
): Set<string> {
  for (const el of els) {
    switch (el.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        acc.add(el.value);
        break;
      case TYPE.select:
      case TYPE.plural:
        acc.add(el.value);
        for (const opt of Object.values(el.options)) collectArgs(opt.value, acc);
        break;
      case TYPE.tag:
        acc.add(el.value);
        collectArgs(el.children, acc);
        break;
      default: // literal, pound → arg yok
        break;
    }
  }
  return acc;
}

const tr = flatten(loadMessages("tr.json"));
const en = flatten(loadMessages("en.json"));

describe("i18n parite", () => {
  it("tr ve en boş değildir (yükleme sağlaması)", () => {
    expect(tr.size).toBeGreaterThan(0);
    expect(en.size).toBe(tr.size);
  });

  it("anahtar kümeleri BİREBİR aynı (eksik/fazla anahtarlar görünür)", () => {
    const missingInEn = [...tr.keys()].filter((k) => !en.has(k)).sort();
    const missingInTr = [...en.keys()].filter((k) => !tr.has(k)).sort();
    expect({ missingInEn, missingInTr }).toEqual({
      missingInEn: [],
      missingInTr: [],
    });
  });

  it("hiçbir çeviri boş / yalnız-boşluk değil", () => {
    const empties = (m: Map<string, unknown>) =>
      [...m]
        .filter(([, v]) => typeof v !== "string" || v.trim() === "")
        .map(([k]) => k)
        .sort();
    expect({ tr: empties(tr), en: empties(en) }).toEqual({ tr: [], en: [] });
  });

  it("ICU/interpolasyon içeren her değer geçerli sözdizimine sahip", () => {
    const icuErrors = (m: Map<string, unknown>, lang: string) => {
      const errs: string[] = [];
      for (const [key, value] of m) {
        if (typeof value !== "string" || !value.includes("{")) continue;
        try {
          parse(value);
        } catch (e) {
          errs.push(`[${lang}] ${key}: ${(e as Error).message}`);
        }
      }
      return errs;
    };
    expect([...icuErrors(tr, "tr"), ...icuErrors(en, "en")]).toEqual([]);
  });

  it("ortak anahtarlarda interpolasyon değişken adları eşleşir", () => {
    // Türkçe düz {count} + İngilizce {count, plural, ...} arg adı AYNI olduğu
    // için pariteyi bozmaz; yalnız FARKLI adlar (ör. {sayı} vs {count}) yakalanır.
    const mismatches: string[] = [];
    for (const [key, trVal] of tr) {
      const enVal = en.get(key);
      if (typeof trVal !== "string" || typeof enVal !== "string") continue;
      if (!trVal.includes("{") && !enVal.includes("{")) continue;
      const trArgs = [...collectArgs(parse(trVal))].sort();
      const enArgs = [...collectArgs(parse(enVal))].sort();
      if (JSON.stringify(trArgs) !== JSON.stringify(enArgs)) {
        mismatches.push(`${key}: tr[${trArgs}] ≠ en[${enArgs}]`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
