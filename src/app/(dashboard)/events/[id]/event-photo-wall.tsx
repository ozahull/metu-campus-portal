"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

export type EventPhoto = {
  id: string;
  url: string;
  storage_path: string;
  caption: string | null;
};

const IMAGE_BUCKET = "club-images";
const MAX_FILES = 10;
const MAX_BYTES = 5 * 1024 * 1024; // ~5MB

// Lightbox ghost-pill kontrolü: yarı saydam açık zemin + border, sıcak koyu
// perde üzerinde iki temada da okunur (primary-foreground ≈ beyaz her iki temada).
const GHOST_PILL =
  "inline-flex items-center justify-center rounded-full border border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground backdrop-blur-sm transition-colors hover:bg-primary-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50";

export function EventPhotoWall({
  eventId,
  photos,
  canManage,
}: {
  eventId: string;
  photos: EventPhoto[];
  canManage: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("photos");
  const tc = useTranslations("confirm");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  // Lightbox klavye gezinme (ok tuşları + Escape).
  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowRight")
        setLightbox((i) => (i === null ? null : (i + 1) % photos.length));
      else if (e.key === "ArrowLeft")
        setLightbox((i) =>
          i === null ? null : (i - 1 + photos.length) % photos.length,
        );
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, photos.length]);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      toast.error(t("toasts.tooMany", { max: MAX_FILES }));
      return;
    }
    if (files.some((f) => f.size > MAX_BYTES)) {
      toast.error(t("toasts.tooBig"));
      return;
    }

    setUploading(true);
    const supabase = createClient();
    let ok = 0;
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `events/${eventId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        toast.error(t("toasts.uploadError", { message: upErr.message }));
        continue;
      }
      const { error: insErr } = await supabase.from("event_photos").insert({
        event_id: eventId,
        uploader_id: (await supabase.auth.getUser()).data.user?.id ?? "",
        storage_path: path,
      });
      if (insErr) {
        toast.error(t("toasts.saveError", { message: insErr.message }));
        continue;
      }
      ok += 1;
    }

    if (ok > 0) {
      // Katılanlara tek bildirim (RPC içinde spam koruması var).
      await supabase.rpc("event_photos_notify", { p_event_id: eventId });
      toast.success(t("toasts.uploaded", { count: ok }));
    }
    setUploading(false);
    router.refresh();
  }

  async function remove(photo: EventPhoto) {
    setDeletingId(photo.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("event_photos")
      .delete()
      .eq("id", photo.id);
    if (error) {
      setDeletingId(null);
      toast.error(t("toasts.deleteError", { message: error.message }));
      return;
    }
    // Storage'dan da temizle (hata yutulur — RLS/erişim sorununda satır zaten gitti).
    await supabase.storage.from(IMAGE_BUCKET).remove([photo.storage_path]);
    setDeletingId(null);
    toast.success(t("toasts.deleted"));
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              disabled={uploading}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              {t("upload")}
            </Button>
          </>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {canManage ? t("emptyManager") : t("empty")}
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p, i) => (
            <li
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              <button
                type="button"
                onClick={() => setLightbox(i)}
                className="block size-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("openPhoto")}
              >
                <Image
                  src={p.url}
                  alt={p.caption ?? t("photoAlt")}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                />
              </button>
              {canManage && (
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      disabled={deletingId === p.id}
                      aria-label={t("deleteAria")}
                      className="absolute top-1.5 right-1.5 inline-flex size-8 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {deletingId === p.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  }
                  title={tc("deletePhotoTitle")}
                  description={tc("deletePhotoBody")}
                  confirmLabel={tc("deletePhotoConfirm")}
                  onConfirm={() => remove(p)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Lightbox — sıcak koyu perde (bg-overlay, iki temada da koyu) +
          ghost-pill kontroller. Açılış/kapanış ve gezinme mantığı değişmez. */}
      {lightbox !== null && photos[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          {/* Üst bar: sayaç · (sil) · kapat */}
          <div
            className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className={cn(GHOST_PILL, "h-9 px-3.5 text-sm font-medium tabular-nums")}
            >
              {lightbox + 1} / {photos.length}
            </span>
            <div className="flex items-center gap-2">
              {canManage && (
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      disabled={deletingId === photos[lightbox].id}
                      aria-label={t("deleteAria")}
                      className={cn(GHOST_PILL, "size-9 hover:text-destructive")}
                    >
                      {deletingId === photos[lightbox].id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  }
                  title={tc("deletePhotoTitle")}
                  description={tc("deletePhotoBody")}
                  confirmLabel={tc("deletePhotoConfirm")}
                  onConfirm={() => {
                    const photo = photos[lightbox];
                    setLightbox(null);
                    void remove(photo);
                  }}
                />
              )}
              <button
                type="button"
                aria-label={tc("cancel")}
                onClick={() => setLightbox(null)}
                className={cn(GHOST_PILL, "size-9")}
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Sol/sağ daire oklar (mobilde kenarda geniş dokunma hedefi) */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label={t("prev")}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((i) =>
                    i === null ? null : (i - 1 + photos.length) % photos.length,
                  );
                }}
                className={cn(GHOST_PILL, "absolute left-2 z-10 size-12 sm:left-4")}
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label={t("next")}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((i) =>
                    i === null ? null : (i + 1) % photos.length,
                  );
                }}
                className={cn(GHOST_PILL, "absolute right-2 z-10 size-12 sm:right-4")}
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}

          <div
            className="relative h-[80vh] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photos[lightbox].url}
              alt={photos[lightbox].caption ?? t("photoAlt")}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>

          {/* Alt orta ipucu (tıklamayı geçirir → boşluğa tıkla = kapat) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
            <span className={cn(GHOST_PILL, "h-8 px-3 text-xs")}>{t("hint")}</span>
          </div>
        </div>
      )}
    </section>
  );
}
