import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Dil B "Sessiz Verimlilik" kapsam sarmalayıcısı (R0). `.surface-admin` kapsam
 * sınıfı globals.css'te zemin/kart/border/radius + nötr taş grisi ailesini
 * remap eder (primary/durum/aksan token'ları global katmandan miras). Yönetim
 * sayfalarının KÖKÜNE uygulanır — (dashboard) grup layout'una DEĞİL — böylece
 * navbar Dil A'da (kum/sıcak) kalır, sayfa içeriği Dil B'ye (beyaz/nötr) döner.
 * Kum zemin sızmasın diye kendi bg-background/text-foreground'ını boyar ve en
 * az bir ekran yüksekliği (min-h-svh) doldurur.
 */
export function AdminSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-admin min-h-svh bg-background text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
