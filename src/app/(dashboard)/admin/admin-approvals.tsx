"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  Clock,
  Inbox,
  Loader2,
  MapPin,
  MessageSquareWarning,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  EventDocuments,
  type EventDocument,
} from "../clubs/[id]/manage/event-documents";

export type PendingEvent = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  review_note: string | null;
  club_name: string | null;
  documents: EventDocument[];
};

/**
 * Okul Onay Kuyruğu (Dil B): her bekleyen etkinlik satır-içi kararlı bir SATIR.
 * Onayla = primary, Reddet = destructive (confirm-dialog ile — window.confirm
 * YOK), Revizyon = nötr (satır-içi not editörü). Odak satırında ince kırmızı
 * sol çizgi (focus-within). Ayarlar (danışman kapısı) artık Ayarlar panelinde.
 */
export function AdminApprovals({
  pending,
  userId,
}: {
  pending: PendingEvent[];
  userId: string;
}) {
  const t = useTranslations("admin.approvals");

  return (
    <section className="space-y-4">
      <header>
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          {t("queueTitle")}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {pending.length}
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">{t("queueDesc")}</p>
      </header>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <Inbox className="size-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t("emptyQueue")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {pending.map((ev) => (
            <PendingRow key={ev.id} ev={ev} userId={userId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PendingRow({ ev, userId }: { ev: PendingEvent; userId: string }) {
  const router = useRouter();
  const t = useTranslations("admin.approvals");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [note, setNote] = useState("");

  async function decide(
    decision: "approve" | "reject" | "changes",
    noteArg?: string,
  ) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("event_school_decision", {
      p_event_id: ev.id,
      p_decision: decision,
      p_note: noteArg?.trim() || undefined,
    });
    setBusy(false);
    if (error) {
      console.error("[admin-approvals] karar hatası:", error);
      toast.error(t("toasts.decideError"));
      return;
    }
    toast.success(
      decision === "approve"
        ? t("toasts.approved")
        : decision === "reject"
          ? t("toasts.rejected")
          : t("toasts.changes"),
    );
    setNoteMode(false);
    setNote("");
    router.refresh();
  }

  function submitChanges() {
    if (note.trim() === "") {
      toast.error(t("toasts.changesNoteRequired"));
      return;
    }
    void decide("changes", note);
  }

  return (
    <li className="relative border-l-2 border-transparent p-4 transition-colors focus-within:border-l-primary hover:bg-secondary/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            {ev.club_name ?? "—"}
          </p>
          <h3 className="font-medium">{ev.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="size-3.5" />
              {formatDateTime(ev.event_date, locale, "short")}
            </span>
            {ev.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {ev.location}
              </span>
            )}
          </div>
          <EventDocuments
            eventId={ev.id}
            userId={userId}
            canUpload={false}
            documents={ev.documents}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            onClick={() => decide("approve")}
            disabled={busy}
            size="sm"
            className="gap-1.5"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {t("approve")}
          </Button>
          <Button
            onClick={() => setNoteMode((v) => !v)}
            disabled={busy}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <MessageSquareWarning className="size-4" />
            {t("requestChanges")}
          </Button>
          <ConfirmDialog
            trigger={
              <Button
                disabled={busy}
                size="sm"
                variant="destructive"
                className="gap-1.5"
              >
                <X className="size-4" />
                {t("reject")}
              </Button>
            }
            title={t("rejectConfirmTitle")}
            description={t("rejectConfirmBody", { title: ev.title })}
            confirmLabel={t("reject")}
            onConfirm={() => decide("reject")}
          />
        </div>
      </div>

      {/* Revizyon notu (satır-içi; modal değil) */}
      {noteMode && (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-secondary/40 p-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t("changesPlaceholder")}
            aria-label={t("changesPlaceholder")}
            disabled={busy}
            className="resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNoteMode(false);
                setNote("");
              }}
              disabled={busy}
            >
              {t("cancelChanges")}
            </Button>
            <Button size="sm" onClick={submitChanges} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("sendChanges")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
