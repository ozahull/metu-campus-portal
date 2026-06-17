"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, Loader2, User, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export type PendingTicket = {
  id: string;
  full_name: string | null;
  receiptSignedUrl: string | null;
};

export type EventTicketGroup = {
  eventId: string;
  title: string;
  capacity: number | null;
  approvedCount: number;
  checkedInCount: number;
  pending: PendingTicket[];
};

export function ManageTickets({ groups }: { groups: EventTicketGroup[] }) {
  const router = useRouter();
  const t = useTranslations("manage.tickets");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(ticketId: string, decision: "approve" | "reject") {
    let note: string | null = null;
    if (decision === "reject") {
      note = window.prompt(t("rejectPrompt"));
      if (note === null) return; // iptal
    }

    setBusyId(ticketId);
    const supabase = createClient();
    const { error } = await supabase.rpc("ticket_approve", {
      p_ticket_id: ticketId,
      p_decision: decision,
      p_note: note?.trim() || undefined,
    });
    setBusyId(null);
    if (error) {
      toast.error(t("toasts.decideError", { message: error.message }));
      return;
    }
    toast.success(decision === "approve" ? t("toasts.approved") : t("toasts.rejected"));
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div
          key={g.eventId}
          className="rounded-lg border border-white/5 bg-white/[0.02] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-white">{g.title}</h4>
            <span className="text-xs text-zinc-400">
              {t("approved", { count: g.approvedCount })}
              {g.capacity !== null && t("capacity", { count: g.capacity })}
              {" · "}
              {t("checkedIn", { count: g.checkedInCount })}
            </span>
          </div>

          {g.pending.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">
              {t("noPending")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {g.pending.map((ticket) => {
                const busy = busyId === ticket.id;
                return (
                  <li
                    key={ticket.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/5 bg-zinc-900/40 px-3 py-2.5"
                  >
                    <span className="inline-flex items-center gap-2 text-sm text-zinc-200">
                      <User className="size-4 text-zinc-500" />
                      {ticket.full_name ?? t("unnamedUser")}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {ticket.receiptSignedUrl ? (
                        <a
                          href={ticket.receiptSignedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/5 hover:text-white"
                        >
                          <ExternalLink className="size-3.5" />
                          {t("receipt")}
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-600">{t("noReceipt")}</span>
                      )}
                      <Button
                        onClick={() => decide(ticket.id, "approve")}
                        disabled={busy}
                        size="sm"
                        className="gap-1.5 bg-emerald-600 font-medium text-white hover:bg-emerald-600/90"
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        {t("approve")}
                      </Button>
                      <Button
                        onClick={() => decide(ticket.id, "reject")}
                        disabled={busy}
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/10"
                      >
                        <X className="size-4" />
                        {t("reject")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
