// Liste kartları için: kullanıcının verilen etkinliklerdeki bilet varlığı
// (EK1 — kart, detay sayfasıyla aynı durumu göstersin: bileti olana RSVP
// butonu değil "Biletin var"). RLS zaten yalnız kendi biletlerini döndürür;
// user_id filtresi açıklık + index için. Tek batch sorgu (N+1 yok).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function fetchMyTicketEventIds(
  supabase: SupabaseClient<Database>,
  userId: string,
  eventIds: string[],
): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("tickets")
    .select("event_id")
    .eq("user_id", userId)
    .in("event_id", eventIds);
  if (error) {
    console.error("[my-tickets] bilet varlık sorgusu hatası:", error);
    return new Set();
  }
  return new Set((data ?? []).map((t) => t.event_id));
}
