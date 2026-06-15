import type { ReactNode } from "react";

/**
 * Tüm kimlik doğrulama sayfaları için ortak görsel kabuk:
 * koyu tema, ekran ortası hizalama ve METU kırmızısı (#841515) ışıması.
 * `dark` sınıfı sayesinde içindeki shadcn bileşenleri koyu tokenlarla render edilir.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="dark relative flex min-h-svh items-center justify-center overflow-hidden bg-zinc-950 px-4 text-foreground">
      {/* METU kırmızısı yumuşak ışıma */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(132,21,21,0.28),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 left-1/2 -z-10 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[#841515]/10 blur-3xl"
      />
      {children}
    </main>
  );
}
