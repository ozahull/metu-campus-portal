// Mesajlaşma UI ortakları (Aşama 4B) — inbox (/messages) ve thread
// (/messages/[id]) aynı etiket mantığını buradan kullanır.
//
// counterpart_label bir MAKİNE token'ı ('SCHOOL_ADMIN' | 'ADVISOR' |
// 'PRESIDENT') YA DA kişi adı (VERİ) taşır — notification-item.tsx
// CLUB_REQUEST_TOKENS emsali: bilinen token yerelleştirilir, tanınmayan
// değer (kişi adı) olduğu gibi gösterilir.

import { GraduationCap, Landmark, Users, type LucideIcon } from "lucide-react";
import { roleLabel } from "@/lib/role-label";

// list_my_conversations RPC satırı (src/types/database.ts ile aynı sözleşme).
export type ConversationRow = {
  conversation_id: string;
  type: string;
  club_id: string | null;
  club_name: string | null;
  counterpart_label: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
};

export const COUNTERPART_TOKENS = ["SCHOOL_ADMIN", "ADVISOR", "PRESIDENT"];

type Translate = (key: string) => string;

/** Kanal başlığı: rol token'ı → merkezî roleLabel (D24); SCHOOL_ADMIN kurum
 *  etiketi olarak messages.counterpart'ta kalır; kişi adı (VERİ) olduğu gibi. */
export function counterpartText(
  label: string | null,
  t: Translate,
  tRoleLabels: Translate,
): string | null {
  if (!label) return null;
  if (label === "SCHOOL_ADMIN") return t("counterpart.SCHOOL_ADMIN");
  if (COUNTERPART_TOKENS.includes(label)) return roleLabel(label, tRoleLabels);
  return label;
}

/** Alt satır: kulüp kanalında kulüp adı, değilse kanal tipinin etiketi. */
export function conversationSubtitle(
  row: Pick<ConversationRow, "club_name" | "type">,
  t: Translate,
): string {
  return row.club_name ?? t(`channelType.${row.type}`);
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  ADMIN_ADVISOR: GraduationCap,
  ADVISOR_PRESIDENT: Users,
  ADMIN_PRESIDENT: Landmark,
};

export function conversationIcon(type: string): LucideIcon {
  return TYPE_ICONS[type] ?? Users;
}
