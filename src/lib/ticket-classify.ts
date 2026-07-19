// Bilet sınıflandırma (aktif/geçmiş) — iki bağımsız boyut (status × zaman).
// SUNUCUDA bir kez hesaplanır, istemciye HAZIR boolean olarak iner (istemci
// Date.now() ile yeniden hesaplamaz — hydration determinizmi, #418 dersi).
// Kural (tickets/page.tsx'ten çıkarıldı — DAVRANIŞ AYNI):
//   AKTİF  = status APPROVED VE etkinlik başlamamış (iptal edilebilir)
//   GEÇMİŞ = CHECKED_IN (girilmiş bilet — etkinlik başlamamış olsa bile) VEYA
//            etkinlik zamanı geçmiş
//   Damga  = CHECKED_IN > geçti (girilmiş bilette "geçti" gösterilmez)

export type TicketClassification = {
  /** Bilet girişte okutulmuş (CHECKED_IN). */
  checkedIn: boolean;
  /** Onaylı + etkinlik başlamamış → aktif bölüm, iptal edilebilir. */
  active: boolean;
  /** Etkinlik geçti, giriş yapılmadı → "geçti" damgası. */
  expired: boolean;
};

export function classifyTicket(params: {
  status: string;
  eventDateMs: number;
  now: number;
}): TicketClassification {
  const { status, eventDateMs, now } = params;
  const checkedIn = status === "CHECKED_IN";
  const started = eventDateMs <= now;
  return {
    checkedIn,
    active: status === "APPROVED" && !started,
    expired: !checkedIn && started,
  };
}
