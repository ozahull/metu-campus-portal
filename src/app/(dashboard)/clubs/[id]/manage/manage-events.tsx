"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  Clock,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ManageEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  status: string;
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

// ISO → datetime-local input değeri (YYYY-MM-DDTHH:mm), yerel saat.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ManageEvents({
  clubId,
  events,
}: {
  clubId: string;
  events: ManageEvent[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ManageEvent | null>(null);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");

  function openCreate() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setEventDate("");
    setLocation("");
    setOpen(true);
  }

  function openEdit(ev: ManageEvent) {
    setEditing(ev);
    setTitle(ev.title);
    setDescription(ev.description ?? "");
    setEventDate(toLocalInput(ev.event_date));
    setLocation(ev.location ?? "");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (title.trim().length === 0) {
      toast.error("Etkinlik adı boş olamaz.");
      return;
    }
    if (!eventDate) {
      toast.error("Lütfen tarih/saat seçin.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      event_date: new Date(eventDate).toISOString(),
      location: location.trim() || null,
    };

    const { error } = editing
      ? await supabase.from("events").update(payload).eq("id", editing.id)
      : await supabase
          .from("events")
          .insert({ ...payload, club_id: clubId, status: "APPROVED" });

    setLoading(false);
    if (error) {
      toast.error(`İşlem başarısız: ${error.message}`);
      return;
    }
    toast.success(editing ? "Etkinlik güncellendi" : "Etkinlik eklendi");
    setOpen(false);
    router.refresh();
  }

  async function handleDelete(ev: ManageEvent) {
    if (!window.confirm(`"${ev.title}" etkinliğini silmek istediğinize emin misiniz?`)) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("events").delete().eq("id", ev.id);
    if (error) {
      toast.error(`Silinemedi: ${error.message}`);
      return;
    }
    toast.success("Etkinlik silindi");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={openCreate}
          size="sm"
          className="gap-1.5 font-medium text-white hover:opacity-90"
          style={{ backgroundColor: "#841515" }}
        >
          <Plus className="size-4" />
          Etkinlik Ekle
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center text-sm text-zinc-500">
          Henüz etkinlik yok. İlk etkinliği ekleyin.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-white">{ev.title}</h4>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                    {ev.status}
                  </span>
                </div>
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
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  onClick={() => openEdit(ev)}
                  size="icon-sm"
                  variant="ghost"
                  className="text-zinc-400 hover:bg-white/5 hover:text-white"
                  aria-label="Düzenle"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  onClick={() => handleDelete(ev)}
                  size="icon-sm"
                  variant="ghost"
                  className="text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                  aria-label="Sil"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="dark border-white/10 bg-zinc-900 text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <CalendarPlus className="size-5 text-[#e7a3a3]" />
              {editing ? "Etkinliği Düzenle" : "Yeni Etkinlik"}
            </DialogTitle>
            <DialogDescription>
              {editing ? "Etkinlik bilgilerini güncelleyin." : "Kulüp için yeni bir etkinlik oluşturun."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ev-title">Etkinlik Adı</Label>
              <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={loading} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-desc">Açıklama</Label>
              <Textarea id="ev-desc" rows={3} className="resize-none" value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-date">Tarih / Saat</Label>
              <Input id="ev-date" type="datetime-local" className="[color-scheme:dark]" value={eventDate} onChange={(e) => setEventDate(e.target.value)} disabled={loading} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-loc">Konum</Label>
              <Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} disabled={loading} />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" disabled={loading} onClick={() => setOpen(false)} className="border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white">
                İptal
              </Button>
              <Button type="submit" disabled={loading} className="gap-2 font-medium text-white hover:opacity-90" style={{ backgroundColor: "#841515" }}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
