"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Plus } from "lucide-react";
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

export function AddEventDialog({ clubId }: { clubId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");

  function resetForm() {
    setTitle("");
    setDescription("");
    setEventDate("");
    setLocation("");
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

    const { error } = await supabase.from("events").insert({
      club_id: clubId,
      title: title.trim(),
      description: description.trim() || null,
      event_date: new Date(eventDate).toISOString(),
      location: location.trim() || null,
      status: "APPROVED",
    });

    setLoading(false);

    if (error) {
      toast.error(`Etkinlik eklenemedi: ${error.message}`);
      return;
    }

    toast.success("Etkinlik başarıyla eklendi");
    resetForm();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="gap-1.5 font-medium text-white hover:opacity-90"
        style={{ backgroundColor: "#841515" }}
      >
        <Plus className="size-4" />
        Etkinlik Ekle
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="dark border-white/10 bg-zinc-900 text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <CalendarPlus className="size-5 text-[#e7a3a3]" />
              Yeni Etkinlik
            </DialogTitle>
            <DialogDescription>
              Kulüp için yeni bir etkinlik oluşturun.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="event-title">Etkinlik Adı</Label>
              <Input
                id="event-title"
                placeholder="Örn. Tanışma Toplantısı"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description">Açıklama</Label>
              <Textarea
                id="event-description"
                placeholder="Etkinlik hakkında kısa bilgi…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-date">Tarih / Saat</Label>
              <Input
                id="event-date"
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                disabled={loading}
                className="[color-scheme:dark]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-location">Konum</Label>
              <Input
                id="event-location"
                placeholder="Örn. MM-25 Amfi"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={loading}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setOpen(false)}
                className="border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
              >
                İptal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="gap-2 font-medium text-white hover:opacity-90"
                style={{ backgroundColor: "#841515" }}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "Ekleniyor…" : "Etkinliği Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
