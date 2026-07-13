"use client";

import Image from "next/image";
import { useState } from "react";
import type { ReactNode } from "react";

/**
 * next/image (fill) + bozuk/eksik görselde zarif fallback. Ebeveyn `relative`
 * ve boyutlu olmalı. src yok ya da yükleme hata verirse `fallback` gösterilir
 * (ör. primary tonlu placeholder + kulüp baş harfi). Supabase Storage host'u
 * next.config.images.remotePatterns'de izinlidir.
 */
export function ImageWithFallback({
  src,
  alt,
  sizes,
  fallback,
}: {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  fallback: ReactNode;
}) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) return <>{fallback}</>;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className="object-cover"
      onError={() => setErrored(true)}
    />
  );
}
