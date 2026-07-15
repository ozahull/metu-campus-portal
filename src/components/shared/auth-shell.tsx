"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
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
 * Masaüstünde solda kampüs fotoğrafı + sıcak gün batımı perdesi + marka bloğu,
 * sağda ferah form alanı. Mobilde yalnızca form (üstte ince sıcak gradyan şerit).
 * Tema-duyarlı; tüm renkler token/color-mix (ham rgba/beyaz YOK). Auth'ta tema
 * switcher yok, sistem teması izlenir.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      {/* Marka paneli (yalnızca masaüstü) */}
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        {/* Katman 0 — opak gün batımı zemini: foto yoksa/yüklenemezse görünür. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(168deg,var(--primary),color-mix(in_oklab,var(--accent-ember)_72%,var(--primary)))]"
        />

        {/* Katman 1 — kampüs fotoğrafı (yavaş Ken Burns; reduced-motion'da durur).
            Yüklenemezse fallback null → Katman 0 gradyanı görünür. */}
        <div aria-hidden="true" className="absolute inset-0">
          <ImageWithFallback
            src={HERO_SRC}
            alt=""
            sizes="(min-width: 1024px) 50vw, 0px"
            priority
            className="animate-kenburns"
            fallback={null}
          />
        </div>

        {/* Katman 2 — okunurluk için sıcak gün batımı perdesi (foto üstünde). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(168deg,color-mix(in_oklab,var(--primary)_78%,transparent),color-mix(in_oklab,var(--primary)_52%,transparent)_46%,color-mix(in_oklab,var(--accent-ember)_46%,transparent))]"
        />

        {/* Sol üstten altın gün ışığı parıltısı. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklab,var(--accent-gold)_26%,transparent),transparent_60%)]"
        />

        {/* Sağ altta yumuşak sıcak parıltı küresi. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-16 size-80 rounded-full bg-accent-gold/20 blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15 text-sm font-bold">
            KKK
          </span>
          <span className="font-semibold tracking-tight">{t("brand")}</span>
        </div>

        <div className="relative z-10">
          <h2 className="font-display text-4xl font-bold tracking-tight text-balance">
            {t("brand")}
          </h2>
          <p className="mt-3 max-w-sm text-primary-foreground/85">
            {tAuth("tagline")}
          </p>
        </div>

        <div className="relative z-10 text-xs tracking-wide text-primary-foreground/70">
          ODTÜ · METU
        </div>
      </aside>

      {/* Form alanı */}
      <div className="relative flex items-center justify-center px-4 py-10 sm:px-6">
        {/* Mobilde üstte ince sıcak gradyan şerit (masaüstünde foto paneli var). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent-gold)_16%,transparent),transparent)] lg:hidden"
        />
        {children}
      </div>
    </main>
  );
}
