import { refreshRoute } from "@/lib/refresh-action";

// Mutasyon SONRASI yerinde tazeleme — TEK kapı. Canlı QA iki yönde de tekil
// mekanizmanın yetmediğini gösterdi: yalnız router.refresh() dil değiştirici
// vakasında route'u güncellemedi (040495c); yalnız Server Action refresh()
// ise bilet İPTALİ ve RSVP akışlarında sayacı güncellemedi (bilet ALMA'da
// çalışırken — aradaki fark izole edilemedi). İKİSİ BİRDEN çağrılır: hangisi
// o akışta işliyorsa sayfayı tazeler; ikisi birden işlerse en kötü ihtimalle
// çift render (zararsız). Mutasyon yapan HER istemci bileşeni başarıdan sonra
// bunu await etmeli — çıplak router.refresh()/refreshRoute() KULLANMA.
export async function refreshAfterMutation(router: {
  refresh: () => void;
}): Promise<void> {
  try {
    await refreshRoute(); // Server Action: aksiyon yanıtı route'u yeniden render eder
  } catch (err) {
    // Aksiyon ulaşamazsa (ağ/deploy anı) istemci tazelemesi yine denenir.
    console.error("[refresh] server action refresh hatası:", err);
  }
  router.refresh();
}
