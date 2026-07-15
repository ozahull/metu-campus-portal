"use client";

import Image from "next/image";
import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * next/image (fill) + bozuk/eksik görselde zarif fallback. Ebeveyn `relative`
 * ve boyutlu olmalı. src yok ya da yükleme hata verirse `fallback` gösterilir
 * (ör. primary tonlu placeholder + kulüp baş harfi ya da gradyan perde). Kırık
 * görsel ikonu ASLA görünmez. Supabase Storage host'u next.config.images.
 * remotePatterns'de izinlidir. `priority` LCP görselleri (auth hero) için,
 * `className` object-cover'a eklenir (ör. Ken Burns imza animasyonu).
 */
export function ImageWithFallback({
  src,
  alt,
  sizes,
  fallback,
  priority,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  fallback: ReactNode;
  priority?: boolean;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) return <>{fallback}</>;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
      onError={() => setErrored(true)}
    />
  );
}
