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
  // Danışman "revizyon iste" satır-içi not editörü (window.prompt YOK — Dil B).
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [ticketCapacity, setTicketCapacity] = useState("");
  const [ticketDeadline, setTicketDeadline] = useState("");

  function openCreate() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setEventDate("");
    setLocation("");
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

    // Bilet alanları (yalnızca kulüp katılım bileti sistemi açıkken yazılır).
    // Ödeme yok — fiyat kaldırıldı; yalnız kontenjan + son tarih.
    let ticketFields: {
      ticket_capacity: number | null;
      ticket_deadline: string | null;
    } | null = null;
    if (ticketEnabled) {
      let capacity: number | null = null;
      if (ticketCapacity.trim() !== "") {
        capacity = Number.parseInt(ticketCapacity, 10);
        if (!Number.isInteger(capacity) || capacity <= 0) {
          toast.error(t("toasts.capacityInvalid"));
          return;
        }
      }
      ticketFields = {
        ticket_capacity: capacity,
        ticket_deadline: ticketDeadline
          ? new Date(ticketDeadline).toISOString()
          : null,
      };
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
    noteArg?: string,
  ) {
    setBusyId(ev.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("event_advisor_decision", {
      p_event_id: ev.id,
      p_decision: decision,
      p_note: noteArg?.trim() || undefined,
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
    setNoteFor(null);
    setNote("");
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
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {events.map((ev) => {
            const meta = statusMeta(ev.status);
            const busy = busyId === ev.id;
            return (
              <li
                key={ev.id}
                className="relative border-l-2 border-transparent p-4 transition-colors focus-within:border-l-primary hover:bg-secondary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium">{ev.title}</h4>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${meta.cls}`}>
                        {t(`status.${ev.status}`)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
                  <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3">
                    {ev.review_note && (
                      <p className="flex items-start gap-2 text-xs text-warning">
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

                {/* Danışman kararları (R4 diliyle: satır-içi not editörü + ConfirmDialog) */}
                {canAdvisorDecide && ev.status === "PENDING_ADVISOR" && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => advisorDecide(ev, "approve")} disabled={busy} size="sm" className="gap-1.5">
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        {t("approve")}
                      </Button>
                      <Button
                        onClick={() => {
                          setNote("");
                          setNoteFor((v) => (v === ev.id ? null : ev.id));
                        }}
                        disabled={busy}
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                      >
                        <MessageSquareWarning className="size-4" /> {t("requestChanges")}
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button disabled={busy} size="sm" variant="destructive" className="gap-1.5">
                            <X className="size-4" /> {t("reject")}
                          </Button>
                        }
                        title={t("rejectConfirmTitle")}
                        description={t("rejectConfirmBody", { title: ev.title })}
                        confirmLabel={t("reject")}
                        onConfirm={() => advisorDecide(ev, "reject")}
                      />
                    </div>

                    {noteFor === ev.id && (
                      <div className="space-y-2 rounded-md border border-border bg-secondary/40 p-3">
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={2}
                          placeholder={t("changesPlaceholder")}
                          disabled={busy}
                          className="resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setNoteFor(null);
                              setNote("");
                            }}
                            disabled={busy}
                          >
                            {t("cancelChanges")}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (note.trim() === "") {
                                toast.error(t("toasts.changesNoteRequired"));
                                return;
                              }
                              void advisorDecide(ev, "changes", note);
                            }}
                            disabled={busy}
                            className="gap-1.5"
                          >
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            {t("sendChanges")}
                          </Button>
                        </div>
                      </div>
                    )}
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

                {/* Ödeme yok — yalnız kontenjan (opsiyonel) + son tarih. */}
                <div className="space-y-2">
                  <Label htmlFor="ev-capacity">{t("capacity")}</Label>
                  <Input id="ev-capacity" type="number" min="1" step="1" inputMode="numeric" placeholder={t("capacityPlaceholder")} value={ticketCapacity} onChange={(e) => setTicketCapacity(e.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ev-deadline">{t("deadline")}</Label>
                  <Input id="ev-deadline" type="datetime-local" className="[color-scheme:light] dark:[color-scheme:dark]" value={ticketDeadline} onChange={(e) => setTicketDeadline(e.target.value)} disabled={loading} />
                  <p className="text-xs text-muted-foreground">{t("deadlineHint")}</p>
                </div>
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
