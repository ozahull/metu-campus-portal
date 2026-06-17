"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(
    ev: PendingEvent,
    decision: "approve" | "reject" | "changes",
  ) {
    let note: string | null = null;
    if (decision !== "approve") {
      note = window.prompt(
        decision === "reject" ? "Reddetme notu (opsiyonel):" : "Revizyon notu:",
      );
      if (note === null) return;
      if (decision === "changes" && note.trim() === "") {
        toast.error("Revizyon için bir not girin.");
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
      toast.error(`İşlem başarısız: ${error.message}`);
      return;
    }
    toast.success(
      decision === "approve"
        ? "Etkinlik onaylandı ve yayında"
        : decision === "reject"
          ? "Etkinlik reddedildi"
          : "Revizyon istendi",
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
      toast.error(`Güncellenemedi: ${error.message}`);
      return;
    }
    toast.success("Onay ayarı güncellendi");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Okul onay kuyruğu */}
      <Card className="border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldQuestion className="size-5 text-[#e7a3a3]" />
            Okul Onay Kuyruğu
            <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-zinc-400">
              {pending.length}
            </span>
          </CardTitle>
          <CardDescription>
            Okul onayı bekleyen etkinlikler. Onaylanınca öğrencilerde yayına girer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400">
                <Inbox className="size-5" />
              </div>
              <p className="mt-3 text-sm text-zinc-500">Bekleyen etkinlik yok.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {pending.map((ev) => {
                const busy = busyId === ev.id;
                return (
                  <li key={ev.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-xs text-zinc-500">{ev.club_name ?? "—"}</p>
                    <h4 className="font-semibold text-white">{ev.title}</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5 text-[#e7a3a3]" />
                        {dateFormatter.format(new Date(ev.event_date))}
                      </span>
                      {ev.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-[#e7a3a3]" />
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
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                      <Button onClick={() => decide(ev, "approve")} disabled={busy} size="sm" className="gap-1.5 bg-emerald-600 font-medium text-white hover:bg-emerald-600/90">
                        <Check className="size-4" /> Onayla
                      </Button>
                      <Button onClick={() => decide(ev, "changes")} disabled={busy} size="sm" variant="outline" className="gap-1.5 border-orange-500/40 bg-transparent text-orange-300 hover:bg-orange-500/10">
                        <MessageSquareWarning className="size-4" /> Revizyon
                      </Button>
                      <Button onClick={() => decide(ev, "reject")} disabled={busy} size="sm" variant="outline" className="gap-1.5 border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/10">
                        <X className="size-4" /> Reddet
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
      <Card className="border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">
            Danışman Onayı Ayarı
          </CardTitle>
          <CardDescription>
            Açıksa etkinlikler önce danışmana, sonra okula gider. Kapalıysa doğrudan
            okul onayına düşer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clubs.length === 0 ? (
            <p className="text-sm text-zinc-500">Kulüp yok.</p>
          ) : (
            <ul className="space-y-2">
              {clubs.map((club) => {
                const busy = busyId === club.id;
                const on = club.requires_advisor_approval;
                return (
                  <li key={club.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
                    <span className="truncate text-sm font-medium text-zinc-200">{club.name}</span>
                    <Button
                      onClick={() => toggleSetting(club)}
                      disabled={busy}
                      size="sm"
                      variant="outline"
                      className={
                        on
                          ? "gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                          : "gap-1.5 border-white/15 bg-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
                      }
                    >
                      {busy && <Loader2 className="size-4 animate-spin" />}
                      {on ? "Açık" : "Kapalı"}
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
