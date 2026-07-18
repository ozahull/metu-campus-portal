// Liste kartları için katılımcı sayıları (Tur 3 ek bulgu — detay/liste
// tutarlılığı). Kaynak, detay sayfasıyla AYNI: biletli etkinlikte geçerli
// bilet sayısı, RSVP etkinliğinde event_attendees — tek batch RPC
// (event_attendance_counts, SECURITY DEFINER; yalnız APPROVED + yalnız sayı).
//
// RPC henüz canlıda yoksa ya da hata dönerse boş map döner — çağıran taraf
// event_attendees sayısına düşer (eski davranış; sayfa kırılmaz).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function fetchAttendanceCounts(
  supabase: SupabaseClient<Database>,
  eventIds: string[],
): Promise<Record<string, number>> {
  if (eventIds.length === 0) return {};
  const { data, error } = await supabase.rpc("event_attendance_counts", {
    p_event_ids: eventIds,
  });
  if (error) {
    console.error("[attendance] event_attendance_counts hatası:", error);
    return {};
  }
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    map[row.event_id] = row.attend_count;
  }
  return map;
}
