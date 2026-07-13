import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sayfa kabuğu: tema-duyarlı zemin (bg-background layout'tan gelir) üstünde
 * marka kırmızısı yumuşak ışıma + ortalanmış içerik konteyneri. Ham renk YOK —
 * ışıma primary token'ından türetilir, iki temada da yaşar.
 */
export function PageShell({
  children,
  glow = true,
  className,
}: {
  children: ReactNode;
  glow?: boolean;
  className?: string;
}) {
  return (
    <main className="relative">
      {glow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(50%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent)]"
        />
      )}
      <div
        className={cn(
          "mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
          className,
        )}
      >
        {children}
      </div>
    </main>
  );
}
