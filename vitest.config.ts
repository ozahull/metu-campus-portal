import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Test altyapısı (chore(test)): saf mantık + i18n parite + iş kuralı testleri.
// Ortam "node" — bu proje testleri tarayıcı/DOM'a GİTMEZ (React bileşenleri değil,
// saf yardımcılar test edilir). `@/*` alias'ı tsconfig ile aynı (./src) — açıkça
// tanımlanır ki test çözümlemesi tsconfck sürümlerinden bağımsız kalsın.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    // Saat dilimi testleri process.env.TZ'yi çalışma anında değiştirir; testler
    // izole olsun diye ayrı dosyalar arası paylaşımlı durum yok (Vitest varsayılanı).
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/supabase/**", "src/types/**"],
      reporter: ["text", "html"],
    },
  },
});
