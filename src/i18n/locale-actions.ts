"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./config";

// Dili NEXT_LOCALE cookie'sine yazar. Çağıran tarafta router.refresh() ile
// sunucu bileşenleri yeni dille yeniden render edilir.
export async function setLocale(locale: Locale) {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 yıl
    sameSite: "lax",
  });
}
