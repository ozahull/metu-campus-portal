"use client";

import type { ReactNode } from "react";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";

/**
 * Kampüs fotoğrafının TEK kaynağı. Gerçek foto gelince yalnızca bu dosya
 * (public/campus/login-hero.jpg) değişir — kod dokunulmaz. Foto yüklenemezse
 * ya da silinirse arkadaki sıcak gün batımı gradyanı (Katman 0) tek başına
 * güzel durur; kırık görsel ikonu ASLA görünmez.
 */
const HERO_SRC = "/campus/login-hero.jpg";

/**
 * Kimlik doğrulama sayfalarının kabuğu (Dil A "Kampüs Enerjisi" imzası).
 * Mockup 1a: kampüs fotoğrafı TÜM ekranı kaplar (full-bleed), form kartı
 * fotoğrafın üstünde yatay+dikey ORTALANMIŞ yüzer. Kart kendi içinde markalı
 * (KKK rozeti + başlık — sayfa kartında), fotoğraf sade sıcak zemin. Katman
 * mantığı korunur: 0 gradyan fallback → 1 foto (Ken Burns) → 2 sıcak perde →
 * 3 altın parıltı. fallback={null} → foto yüklenemezse Katman 0 gradyanı tek
 * başına güzel durur (kırık ikon YOK). Zemin `fixed` olduğundan uzun formlarda
 * (kayıt) kart dikey kaydırılır, foto yerinde kalır. Tüm renkler token/
 * color-mix (ham rgba/beyaz YOK). Tema-duyarlı; auth'ta tema switcher yok.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative">
      {/* Tam ekran kampüs zemini (sabit): kart üstünde yüzerken foto yerinde kalır. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 overflow-hidden bg-primary"
      >
        {/* Katman 0 — opak gün batımı zemini: foto yoksa/yüklenemezse görünür. */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(168deg,var(--primary),color-mix(in_oklab,var(--accent-ember)_72%,var(--primary)))]" />

        {/* Katman 1 — kampüs fotoğrafı (yavaş Ken Burns; reduced-motion'da durur).
            Yüklenemezse fallback null → Katman 0 gradyanı görünür. */}
        <div className="absolute inset-0">
          <ImageWithFallback
            src={HERO_SRC}
            alt=""
            sizes="100vw"
            priority
            className="animate-kenburns"
            fallback={null}
          />
        </div>

        {/* Katman 2 — sıcak gün batımı perdesi: fotoğrafa Dil A tonu + derinlik. */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(168deg,color-mix(in_oklab,var(--primary)_66%,transparent),color-mix(in_oklab,var(--primary)_38%,transparent)_48%,color-mix(in_oklab,var(--accent-ember)_46%,transparent))]" />

        {/* Katman 3 — sol üstten altın gün ışığı radial parıltısı. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklab,var(--accent-gold)_24%,transparent),transparent_60%)]" />

        {/* Sağ altta yumuşak sıcak parıltı küresi. */}
        <div className="pointer-events-none absolute -right-16 -bottom-24 size-80 rounded-full bg-accent-gold/20 blur-3xl" />
      </div>

      {/* Yüzen form kartı — yatay+dikey ortalı; uzun formda dikey kaydırır. */}
      <div className="relative z-10 flex min-h-svh items-center justify-center p-4 sm:p-6">
        {children}
      </div>
    </main>
  );
}
