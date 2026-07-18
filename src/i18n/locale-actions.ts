"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./config";

// Dili NEXT_LOCALE cookie'sine yazar ve MEVCUT route'u aynı aksiyon yanıtında
// yeniden render ettirir (Next 16 refresh()). İstemciden ayrıca
// router.refresh() ÇAĞRILMAZ — eski desen açık sayfayı güncellemiyordu
// (html lang + menü tiki bayat kalıyor, çeviri ancak gezinince geliyordu).
export async function setLocale(locale: Locale) {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 yıl
    sameSite: "lax",
  });
  refresh();
}
