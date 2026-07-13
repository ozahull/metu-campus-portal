"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarPlus,
  Check,
  Clock,
  Loader2,
  MapPin,
  MessageSquareWarning,
  Pencil,
  Plus,
  RotateCw,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { statusMeta } from "@/lib/event-status";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventDocuments, type EventDocument } from "./event-documents";

export type ManageEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  status: string;
  review_note: string | null;
  ticket_price: number | null;
  ticket_capacity: number | null;
  ticket_deadline: string | null;
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ManageEvents({
  clubId,
  events,
  canAdvisorDecide,
  ticketEnabled,
  userId,
  canUploadDocs,
  documentsByEvent,
}: {
  clubId: string;
  events: ManageEvent[];
  // Danışman/okul: PENDING_ADVISOR etkinlikleri için karar verebilir.
  canAdvisorDecide: boolean;
  // Kulübün bilet sistemi açıksa etkinlik formunda bilet alanları görünür.
  ticketEnabled: boolean;
  // Belge yükleme yolu için mevcut kullanıcı kimliği.
  userId: string;
  // Başkan/okul belge yükleyebilir; danışman yalnızca görüntüler.
  canUploadDocs: boolean;
  // Etkinlik id → o etkinliğe yüklü belgeler (signed URL'li, server-side).
  documentsByEvent: Record<string, EventDocument[]>;
}) {
  const router = useRouter();
  const t = useTranslations("manage.events");
  const tc = useTranslations("confirm");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ManageEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [ticketPrice, setTicketPrice] = useState("");
  const [ticketCapacity, setTicketCapacity] = useState("");
  const [ticketDeadline, setTicketDeadline] = useState("");

  function openCreate() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setEventDate("");
    setLocation("");
    setIsPaid(false);
    setTicketPrice("");
    setTicketCapacity("");
    setTicketDeadline("");
    setOpen(true);
  }

  function openEdit(ev: ManageEvent) {
    setEditing(ev);
    setTitle(ev.title);
    setDescription(ev.description ?? "");
    setEventDate(toLocalInput(ev.event_date));
    setLocation(ev.location ?? "");
    setIsPaid(ev.ticket_price !== null && Number(ev.ticket_price) > 0);
    setTicketPrice(ev.ticket_price !== null ? String(ev.ticket_price) : "");
    setTicketCapacity(
      ev.ticket_capacity !== null ? String(ev.ticket_capacity) : "",
    );
    setTicketDeadline(ev.ticket_deadline ? toLocalInput(ev.ticket_deadline) : "");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (title.trim().length === 0) {
      toast.error(t("toasts.titleRequired"));
      return;
    }
    if (!eventDate) {
      toast.error(t("toasts.dateRequired"));
      return;
    }

    // Bilet alanları (yalnızca kulüp bilet sistemi açıkken yazılır).
    let ticketFields: {
      ticket_price: number | null;
      ticket_capacity: number | null;
      ticket_deadline: string | null;
    } | null = null;
    if (ticketEnabled) {
      if (!isPaid) {
        // Ücretsiz: tüm bilet alanları temizlenir.
        ticketFields = {
          ticket_price: null,
          ticket_capacity: null,
          ticket_deadline: null,
        };
      } else {
        // Ücretli: fiyat zorunlu ve > 0.
        const price = Number(ticketPrice);
        if (ticketPrice.trim() === "" || !Number.isFinite(price) || price <= 0) {
          toast.error(t("toasts.priceInvalid"));
          return;
        }
        let capacity: number | null = null;
        if (ticketCapacity.trim() !== "") {
          capacity = Number.parseInt(ticketCapacity, 10);
          if (!Number.isInteger(capacity) || capacity <= 0) {
            toast.error(t("toasts.capacityInvalid"));
            return;
          }
        }
        ticketFields = {
          ticket_price: price,
          ticket_capacity: capacity,
          ticket_deadline: ticketDeadline
            ? new Date(ticketDeadline).toISOString()
            : null,
        };
      }
    }

    setLoading(true);
    const supabase = createClient();
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      event_date: new Date(eventDate).toISOString(),
      location: location.trim() || null,
      ...(ticketFields ?? {}),
    };

    if (editing) {
      const { error } = await supabase
        .from("events")
        .update(payload)
        .eq("id", editing.id);
      setLoading(false);
      if (error) {
        toast.error(t("toasts.updateError", { message: error.message }));
        return;
      }
      toast.success(t("toasts.updated"));
      setOpen(false);
      router.refresh();
      return;
    }

    // Oluştur: status GÖNDERME (DB default PENDING_SCHOOL; doğrudan yazım
    // kolon-grant ile zaten engelli). Eklendikten sonra event_submit ile akışa sok.
    const { data: created, error: insertError } = await supabase
      .from("events")
      .insert({ ...payload, club_id: clubId })
      .select("id")
      .single();

    if (insertError || !created) {
      setLoading(false);
      toast.error(
        t("toasts.createError", {
          message: insertError?.message ?? "unknown error",
        }),
      );
      return;
    }

    const { error: submitError } = await supabase.rpc("event_submit", {
      p_event_id: created.id,
    });
    setLoading(false);
    if (submitError) {
      toast.error(t("toasts.submitError", { message: submitError.message }));
      return;
    }
    toast.success(t("toasts.created"));
    setOpen(false);
    router.refresh();
  }

  async function handleDelete(ev: ManageEvent) {
    const supabase = createClient();
    const { error } = await supabase.from("events").delete().eq("id", ev.id);
    if (error) {
      toast.error(t("toasts.deleteError", { message: error.message }));
      return;
    }
    toast.success(t("toasts.deleted"));
    router.refresh();
  }

  async function resubmit(ev: ManageEvent) {
    setBusyId(ev.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("event_submit", { p_event_id: ev.id });
    setBusyId(null);
    if (error) {
      toast.error(t("toasts.resubmitError", { message: error.message }));
      return;
    }
    toast.success(t("toasts.resubmitted"));
    router.refresh();
  }

  async function advisorDecide(
    ev: ManageEvent,
    decision: "approve" | "reject" | "changes",
  ) {
    let note: string | null = null;
    if (decision !== "approve") {
      note = window.prompt(
        decision === "reject" ? t("rejectPrompt") : t("changesPrompt"),
      );
      if (note === null) return; // iptal
      if (decision === "changes" && note.trim() === "") {
        toast.error(t("toasts.changesNoteRequired"));
        return;
      }
    }

    setBusyId(ev.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("event_advisor_decision", {
      p_event_id: ev.id,
      p_decision: decision,
      p_note: note?.trim() || undefined,
    });
    setBusyId(null);
    if (error) {
      toast.error(t("toasts.decideError", { message: error.message }));
      return;
    }
    toast.success(
      decision === "approve"
        ? t("toasts.approved")
        : decision === "reject"
          ? t("toasts.rejected")
          : t("toasts.changes"),
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm" className="gap-1.5 font-medium">
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 px-5 py-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => {
            const meta = statusMeta(ev.status);
            const busy = busyId === ev.id;
            return (
              <li
                key={ev.id}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold">{ev.title}</h4>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
                        {t(`status.${ev.status}`)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5 text-primary" />
                        {formatDateTime(ev.event_date, locale, "short")}
                      </span>
                      {ev.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-primary" />
                          {ev.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button onClick={() => openEdit(ev)} size="icon-sm" variant="ghost" aria-label={t("editAria")}>
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={t("deleteAria")}>
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title={tc("deleteEventTitle")}
                      description={tc("deleteEventBody", { title: ev.title })}
                      confirmLabel={tc("deleteEventConfirm")}
                      onConfirm={() => handleDelete(ev)}
                    />
                  </div>
                </div>

                {/* Revizyon notu + tekrar gönder */}
                {ev.status === "CHANGES_REQUESTED" && (
                  <div className="mt-3 rounded-md border border-orange-500/25 bg-orange-500/10 p-3">
                    {ev.review_note && (
                      <p className="flex items-start gap-2 text-xs text-orange-700 dark:text-orange-300">
                        <MessageSquareWarning className="mt-0.5 size-3.5 shrink-0" />
                        {ev.review_note}
                      </p>
                    )}
                    <Button onClick={() => resubmit(ev)} disabled={busy} size="sm" variant="outline" className="mt-2 gap-1.5">
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
                      {t("resubmit")}
                    </Button>
                  </div>
                )}

                {/* Danışman kararları */}
                {canAdvisorDecide && ev.status === "PENDING_ADVISOR" && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button onClick={() => advisorDecide(ev, "approve")} disabled={busy} size="sm" className="gap-1.5 bg-success font-medium text-success-foreground hover:bg-success/90">
                      <Check className="size-4" /> {t("approve")}
                    </Button>
                    <Button onClick={() => advisorDecide(ev, "changes")} disabled={busy} size="sm" variant="outline" className="gap-1.5 border-orange-500/40 text-orange-700 hover:bg-orange-500/10 dark:text-orange-300">
                      <MessageSquareWarning className="size-4" /> {t("requestChanges")}
                    </Button>
                    <Button onClick={() => advisorDecide(ev, "reject")} disabled={busy} size="sm" variant="destructive" className="gap-1.5">
                      <X className="size-4" /> {t("reject")}
                    </Button>
                  </div>
                )}

                {/* Belge ekleri (başkan yükler; danışman/okul görüntüler) */}
                <EventDocuments
                  eventId={ev.id}
                  userId={userId}
                  canUpload={canUploadDocs}
                  documents={documentsByEvent[ev.id] ?? []}
                  emphasize={ev.status === "CHANGES_REQUESTED"}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="size-5 text-primary" />
              {editing ? t("dialogEditTitle") : t("dialogCreateTitle")}
            </DialogTitle>
            <DialogDescription>
              {editing ? t("dialogEditDesc") : t("dialogCreateDesc")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ev-title">{t("fieldTitle")}</Label>
              <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={loading} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-desc">{t("fieldDesc")}</Label>
              <Textarea id="ev-desc" rows={3} className="resize-none" value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-date">{t("fieldDate")}</Label>
              <Input id="ev-date" type="datetime-local" className="[color-scheme:light] dark:[color-scheme:dark]" value={eventDate} onChange={(e) => setEventDate(e.target.value)} disabled={loading} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-loc">{t("fieldLocation")}</Label>
              <Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} disabled={loading} />
            </div>

            {ticketEnabled && (
              <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-medium">
                  <Ticket className="size-4 text-primary" />
                  {t("ticketSettings")}
                </p>

                {/* Ücretsiz / Ücretli seçimi (varsayılan: Ücretsiz) */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPaid(false)}
                    disabled={loading}
                    aria-pressed={!isPaid}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                      !isPaid
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {t("free")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPaid(true)}
                    disabled={loading}
                    aria-pressed={isPaid}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                      isPaid
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {t("paid")}
                  </button>
                </div>

                {isPaid && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="ev-price">
                        {t("price")} <span className="text-primary">*</span>
                      </Label>
                      <Input id="ev-price" type="number" min="0" step="0.01" inputMode="decimal" placeholder={t("pricePlaceholder")} value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ev-capacity">{t("capacity")}</Label>
                      <Input id="ev-capacity" type="number" min="1" step="1" inputMode="numeric" placeholder={t("capacityPlaceholder")} value={ticketCapacity} onChange={(e) => setTicketCapacity(e.target.value)} disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ev-deadline">{t("deadline")}</Label>
                      <Input id="ev-deadline" type="datetime-local" className="[color-scheme:light] dark:[color-scheme:dark]" value={ticketDeadline} onChange={(e) => setTicketDeadline(e.target.value)} disabled={loading} />
                      <p className="text-xs text-muted-foreground">{t("deadlineHint")}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" disabled={loading} onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={loading} className="gap-2 font-medium">
                {loading && <Loader2 className="size-4 animate-spin" />}
                {editing ? t("saveEdit") : t("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
