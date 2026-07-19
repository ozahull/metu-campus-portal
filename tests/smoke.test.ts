// Altyapı doğrulaması (chore(test)): test koşucusunun çalıştığını ve `@/*`
// alias'ının çözüldüğünü kanıtlayan asgari örnek. Gerçek kapsam sonraki
// commit'lerde (saf mantık / i18n parite / iş kuralları).
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("test altyapısı", () => {
  it("çalışıyor", () => {
    expect(1 + 1).toBe(2);
  });

  it("@/* alias'ı çözülüyor (cn helper import edilebiliyor)", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
