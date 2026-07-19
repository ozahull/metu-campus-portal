"use client";

import { useTranslations } from "next-intl";
import { Ticket, UserCheck } from "lucide-react";

export type EventTicketGroup = {
  eventId: string;
  title: string;
  capacity: number | null;
  issuedCount: number;
  checkedInCount: number;
};

// Ödeme kaldırıldı: dekont onay kuyruğu yok. Bu bölüm artık salt-okunur
// katılım/check-in özeti (kaç bilet verildi, kaç giriş yapıldı). Kapıda giriş
// için check-in linki panel başlığındadır (manage/page.tsx).
export function ManageTickets({ groups }: { groups: EventTicketGroup[] }) {
  const t = useTranslations("manage.tickets");

  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/40 px-5 py-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div
          key={g.eventId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
        >
          <h3 className="min-w-0 truncate font-medium">{g.title}</h3>
          <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <Ticket className="size-3.5" />
              {t("issued", { count: g.issuedCount })}
              {g.capacity !== null && t("capacity", { count: g.capacity })}
            </span>
            <span className="inline-flex items-center gap-1.5 text-success">
              <UserCheck className="size-3.5" />
              {t("checkedIn", { count: g.checkedInCount })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
