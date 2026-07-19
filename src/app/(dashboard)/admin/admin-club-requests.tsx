"use client";
import { refreshAfterMutation } from "@/lib/refresh";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  Clock,
  Inbox,
  Loader2,
  MessageSquareWarning,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel } from "@/lib/category";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  EventDocuments,
  type EventDocument,
} from "../clubs/[id]/manage/event-documents";

export type PendingClubRequest = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  rationale: string | null;
  requester_name: string;
  created_at: string;
  documents: EventDocument[];
};

/**
 * Topluluk Başvuru Kuyruğu (Dil B) — admin-approvals.tsx'in kopyası-uyarlaması.
 * Her PENDING başvuru satır-içi kararlı bir SATIR: Onayla = primary, Revizyon =
 * nötr (satır-içi Textarea), Reddet = destructive (ConfirmDialog — window.confirm
 * YOK). RPC: club_request_decide(p_request_id, p_decision, p_note). Reddet ve
 * revizyonda not zorunlu (hocaya gerekçe dönsün). Belgeler view-only (EventDocuments
 * canUpload=false). Odak satırında ince kırmızı sol çizgi (focus-within).
 */
export function AdminClubRequests({
  clubRequests,
  userId,
}: {
  clubRequests: PendingClubRequest[];
  userId: string;
}) {
  const t = useTranslations("admin.clubRequests");

  return (
    <section className="space-y-4">
      <header>
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          {t("queueTitle")}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {clubRequests.length}
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">{t("queueDesc")}</p>
      </header>

      {clubRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <Inbox className="size-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t("emptyQueue")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {clubRequests.map((req) => (
            <RequestRow key={req.id} req={req} userId={userId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestRow({
  req,
  userId,
}: {
  req: PendingClubRequest;
  userId: string;
}) {
  const router = useRouter();
  const t = useTranslations("admin.clubRequests");
  const tCategories = useTranslations("categories");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  // Tek satır-içi editör; iki mod: revizyon notu veya reddetme gerekçesi.
  const [mode, setMode] = useState<null | "changes" | "reject">(null);
  const [note, setNote] = useState("");
  // Optimistic gizleme: karar başarılı olunca kart anında kaybolsun; server
  // round-trip (router.refresh) tamamlanana kadar stale görünmesin.
  const [done, setDone] = useState(false);

  async function decide(
    decision: "approve" | "reject" | "changes",
    noteArg?: string,
  ) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("club_request_decide", {
      p_request_id: req.id,
      p_decision: decision,
      p_note: noteArg?.trim() || undefined,
    });
    setBusy(false);
    if (error) {
      console.error("[admin-club-requests] karar hatası:", error);
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
    setMode(null);
    setNote("");
    setDone(true); // router.refresh()'ten ÖNCE: kart anında kaybolur, sayaç görsel azalır.
    await refreshAfterMutation(router);
  }

  function toggleMode(next: "changes" | "reject") {
    setNote("");
    setMode((m) => (m === next ? null : next));
  }

  function submitChanges() {
    if (note.trim() === "") {
      toast.error(t("toasts.changesNoteRequired"));
      return;
    }
    void decide("changes", note);
  }

  // Karar verildiyse kart anında yok olur; kesin listeyi router.refresh() getirir.
  if (done) return null;

  return (
    <li className="relative border-l-2 border-transparent p-4 transition-colors focus-within:border-l-primary hover:bg-secondary/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            {t("requesterLabel")}: {req.requester_name}
          </p>
          <h3 className="font-medium">{req.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="size-3.5" />
              {formatDateTime(req.created_at, locale, "short")}
            </span>
            {req.category && (
              <span className="inline-flex items-center gap-1.5">
                <Tag className="size-3.5" />
                {categoryLabel(req.category, tCategories)}
              </span>
            )}
          </div>

          {req.description && (
            <div className="mt-3 text-sm">
              <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                {t("descriptionLabel")}
              </p>
              <p className="mt-0.5 break-words whitespace-pre-wrap text-foreground">
                {req.description}
              </p>
            </div>
          )}
          <div className="mt-3 text-sm">
            <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
              {t("rationaleLabel")}
            </p>
            <p className="mt-0.5 break-words whitespace-pre-wrap text-foreground">
              {req.rationale || "—"}
            </p>
          </div>

          <EventDocuments
            eventId={req.id}
            userId={userId}
            canUpload={false}
            documents={req.documents}
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
            onClick={() => toggleMode("changes")}
            disabled={busy}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <MessageSquareWarning className="size-4" />
            {t("requestChanges")}
          </Button>
          <Button
            onClick={() => toggleMode("reject")}
            disabled={busy}
            size="sm"
            variant="destructive"
            className="gap-1.5"
          >
            <X className="size-4" />
            {t("reject")}
          </Button>
        </div>
      </div>

      {/* Satır-içi not editörü (revizyon ya da reddetme gerekçesi) — modal değil */}
      {mode && (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-secondary/40 p-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={
              mode === "reject"
                ? t("rejectPlaceholder")
                : t("changesPlaceholder")
            }
            aria-label={
              mode === "reject"
                ? t("rejectPlaceholder")
                : t("changesPlaceholder")
            }
            disabled={busy}
            className="resize-none"
          />
          {mode === "reject" && (
            <p className="text-xs text-muted-foreground">
              {t("rejectNoteHint")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMode(null);
                setNote("");
              }}
              disabled={busy}
            >
              {t("cancelChanges")}
            </Button>
            {mode === "changes" ? (
              <Button size="sm" onClick={submitChanges} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {t("sendChanges")}
              </Button>
            ) : (
              <ConfirmDialog
                trigger={
                  // Not boşken dialog HİÇ açılmasın: buton pasif, kullanıcı önce
                  // gerekçe yazsın. onConfirm'deki guard savunma amaçlı kalır.
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy || note.trim() === ""}
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    {t("reject")}
                  </Button>
                }
                title={t("rejectConfirmTitle")}
                description={t("rejectConfirmBody", { name: req.name })}
                confirmLabel={t("reject")}
                onConfirm={() => {
                  // Not zorunlu: gerekçe boşsa reddetme, hocaya sebep dönsün.
                  if (note.trim() === "") {
                    toast.error(t("toasts.rejectNoteRequired"));
                    return;
                  }
                  void decide("reject", note);
                }}
              />
            )}
          </div>
        </div>
      )}
    </li>
  );
}
