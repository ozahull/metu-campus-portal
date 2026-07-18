"use client";

import { useEffect } from "react";

// Service worker kaydı (Aşama 5A). Görsel çıktısı yok; root layout'a eklenir.
// Destek olmayan tarayıcıda (eski Safari, SSR) sessizce atlanır — push
// zorunlu bir özellik değil, kayıt hatası kullanıcıya yansıtılmaz.
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Kayıt başarısız olsa da uygulama normal çalışmaya devam eder.
    });
  }, []);
  return null;
}
