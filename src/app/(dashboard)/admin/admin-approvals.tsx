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
  ShieldQuestion,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export type ClubSetting = {
  id: string;
  name: string;
  requires_advisor_approval: boolean;
};

export function AdminApprovals({
  pending,
  clubs,
  userId,
}: {
  pending: PendingEvent[];
  clubs: ClubSetting[];
  userId: string;
}) {
  const router = useRouter();
  const t = useTranslations("admin.approvals");
  const locale = useLocale();
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(
    ev: PendingEvent,
    decision: "approve" | "reject" | "changes",
  ) {
    let note: string | null = null;
    if (decision !== "approve") {
      note = window.prompt(
        decision === "reject" ? t("rejectPrompt") : t("changesPrompt"),
      );
      if (note === null) return;
      if (decision === "changes" && note.trim() === "") {
        toast.error(t("toasts.changesNoteRequired"));
        return;
      }
    }
    setBusyId(ev.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("event_school_decision", {
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

  async function toggleSetting(club: ClubSetting) {
    setBusyId(club.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("clubs")
      .update({ requires_advisor_approval: !club.requires_advisor_approval })
      .eq("id", club.id);
    setBusyId(null);
    if (error) {
      toast.error(t("toasts.settingError", { message: error.message }));
      return;
    }
    toast.success(t("toasts.settingUpdated"));
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Okul onay kuyruğu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <ShieldQuestion className="size-5 text-primary" />
            {t("queueTitle")}
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {pending.length}
            </span>
          </CardTitle>
          <CardDescription>
            {t("queueDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Inbox className="size-5" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {t("emptyQueue")}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {pending.map((ev) => {
                const busy = busyId === ev.id;
                return (
                  <li key={ev.id} className="rounded-lg border border-border bg-muted/40 p-4">
                    <p className="text-xs text-muted-foreground">{ev.club_name ?? "—"}</p>
                    <h4 className="font-semibold">{ev.title}</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5 text-primary" />
                        {dateFormatter.format(new Date(ev.event_date))}
                      </span>
                      {ev.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-primary" />
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
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                      <Button onClick={() => decide(ev, "approve")} disabled={busy} size="sm" className="gap-1.5 bg-success font-medium text-success-foreground hover:bg-success/90">
                        <Check className="size-4" /> {t("approve")}
                      </Button>
                      <Button onClick={() => decide(ev, "changes")} disabled={busy} size="sm" variant="outline" className="gap-1.5 border-orange-500/40 text-orange-700 hover:bg-orange-500/10 dark:text-orange-300">
                        <MessageSquareWarning className="size-4" /> {t("requestChanges")}
                      </Button>
                      <Button onClick={() => decide(ev, "reject")} disabled={busy} size="sm" variant="destructive" className="gap-1.5">
                        <X className="size-4" /> {t("reject")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Onay ayarı (danışman kapısı aç/kapat) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {t("settingsTitle")}
          </CardTitle>
          <CardDescription>
            {t("settingsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clubs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noClubs")}</p>
          ) : (
            <ul className="space-y-2">
              {clubs.map((club) => {
                const busy = busyId === club.id;
                const on = club.requires_advisor_approval;
                return (
                  <li key={club.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                    <span className="truncate text-sm font-medium">{club.name}</span>
                    <Button
                      onClick={() => toggleSetting(club)}
                      disabled={busy}
                      size="sm"
                      variant="outline"
                      className={
                        on
                          ? "gap-1.5 border-success/40 bg-success/15 text-success hover:bg-success/25"
                          : "gap-1.5"
                      }
                    >
                      {busy && <Loader2 className="size-4 animate-spin" />}
                      {on ? t("on") : t("off")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
