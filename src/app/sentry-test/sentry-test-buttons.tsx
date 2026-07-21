"use client";

// Sentry doğrulama tetikleyicileri (GEÇİCİ).
//  • Tarayıcı hatası: event handler içinde throw → global handler → Sentry (client).
//  • Sunucu hatası: /api/sentry-test'e istek → route throw → Sentry (server).
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SentryTestButtons() {
  const [note, setNote] = useState<string>("");

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className={cn(buttonVariants({ variant: "destructive" }), "h-11")}
        onClick={() => {
          // Event handler'da fırlatılan hata error boundary'ye TAKILMAZ; global
          // handler'a çıkar → Sentry client init bunu yakalar.
          throw new Error(
            "Sentry doğrulama — kasıtlı TARAYICI hatası (client). Görünüyorsa tarayıcı izleme çalışıyor.",
          );
        }}
      >
        Tarayıcı hatası fırlat
      </button>

      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline" }), "h-11")}
        onClick={async () => {
          setNote("Sunucuya istek gönderildi…");
          try {
            const res = await fetch("/api/sentry-test");
            setNote(`Sunucu yanıtı: ${res.status} (500 beklenir → Sentry'de görünmeli).`);
          } catch {
            setNote("İstek başarısız (yine de sunucu hatası Sentry'ye düşmüş olabilir).");
          }
        }}
      >
        Sunucu hatası fırlat
      </button>

      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
    </div>
  );
}
