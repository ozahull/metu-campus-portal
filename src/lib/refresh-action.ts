"use server";

import { refresh } from "next/cache";

// Next 16: istemciden çağrılan router.refresh() açık route'u güvenilir şekilde
// yeniden render ETMİYOR (kanıt: dil değiştirici — 040495c; QA: RSVP sonrası
// sayaç ancak tam yenilemede güncelleniyordu). Çalışan desen: Server Action
// içinde next/cache refresh() — aksiyon yanıtı mevcut route'u sunucuda yeniden
// render ettirir ve sayaç/kapasite barı gibi sunucu bileşenleri YERİNDE tazelenir.
// Mutasyon yapan istemci bileşeni başarıdan sonra bunu await eder.
export async function refreshRoute() {
  refresh();
}
