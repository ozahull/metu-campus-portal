"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * Kimlik doğrulama sayfalarının kabuğu: masaüstünde solda marka kimlikli
 * gradient panel (CSS gradient — illüstrasyon yok), sağda ferah form alanı.
 * Mobilde yalnızca form. Tema-duyarlı (token'lar); auth'ta tema switcher yok,
 * sistem teması izlenir.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      {/* Marka paneli (yalnızca masaüstü) */}
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,255,255,0.22),transparent_60%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-16 size-80 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15 text-sm font-bold">
            KKK
          </span>
          <span className="font-semibold tracking-tight">{t("brand")}</span>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            {t("brand")}
          </h2>
          <p className="mt-3 max-w-sm text-primary-foreground/80">
            {tAuth("tagline")}
          </p>
        </div>

        <div className="relative text-xs tracking-wide text-primary-foreground/60">
          ODTÜ · METU
        </div>
      </aside>

      {/* Form alanı */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-6">
        {children}
      </div>
    </main>
  );
}
