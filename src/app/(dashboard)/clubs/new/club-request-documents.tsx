"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export type ClubRequestDocument = {
  id: string;
  file_name: string;
  note: string | null;
  // Kısa ömürlü signed URL (server-side üretildi; public URL ASLA).
  signedUrl: string | null;
  // Yalnızca yükleyen kendi belgesini silebilir (RLS).
  canDelete: boolean;
};

// event-docs deseninin kopyası; yalnız bucket + hedef tablo + namespace farklı.
const DOC_BUCKET = "club-request-docs";

export function ClubRequestDocuments({
  requestId,
  userId,
  canUpload,
  documents,
  emphasize = false,
}: {
  // request_id yoksa bu bileşen HİÇ render edilmez (parent karar verir); yalnız
  // başvuru kaydı oluştuktan sonra (PENDING/CHANGES_REQUESTED) gösterilir.
  requestId: string;
  userId: string;
  // Başvuru sahibi hoca kendi PENDING/CHANGES_REQUESTED başvurusuna yükleyebilir.
  canUpload: boolean;
  documents: ClubRequestDocument[];
  emphasize?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("clubRequest.documents");
  const tc = useTranslations("confirm");
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const supabase = createClient();

    // Storage INSERT policy: path ${request_id}/${uploaded_by}-*; uid eşleşmesi şart.
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${requestId}/${userId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(DOC_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || undefined });

    if (uploadError) {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Ham backend mesajını kullanıcıya SIZDIRMA (RLS/policy detayı); yalnız debug.
      console.error("[club-request-documents] yükleme hatası:", uploadError.message);
      toast.error(t("toasts.uploadError"));
      return;
    }

    // Public URL DEĞİL — yalnızca dosya yolunu sakla; görüntüleme signed URL ile.
    const { error: insertError } = await supabase
      .from("club_request_documents")
      .insert({
        request_id: requestId,
        uploaded_by: userId,
        file_url: path,
        file_name: file.name,
        note: note.trim() || null,
      });

    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (insertError) {
      console.error("[club-request-documents] kayıt hatası:", insertError.message);
      toast.error(t("toasts.saveError"));
      return;
    }
    setNote("");
    toast.success(t("toasts.uploaded"));
    router.refresh();
  }

  async function handleDelete(doc: ClubRequestDocument) {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("club_request_documents")
      .delete()
      .eq("id", doc.id);
    setLoading(false);
    if (error) {
      console.error("[club-request-documents] silme hatası:", error.message);
      toast.error(t("toasts.deleteError"));
      return;
    }
    toast.success(t("toasts.deleted"));
    router.refresh();
  }

  // Yükleme yetkisi yoksa ve hiç belge yoksa bileşeni gizle.
  if (!canUpload && documents.length === 0) return null;

  return (
    <div
      className={`mt-3 rounded-md border p-3 ${
        emphasize
          ? "border-primary/40 bg-primary/10"
          : "border-border bg-muted/40"
      }`}
    >
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Paperclip className="size-3.5 text-primary" />
        {t("title")}
        {emphasize && <span className="text-primary">{t("emphasizeNote")}</span>}
      </p>

      {documents.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm">{doc.file_name}</p>
                  {doc.note && (
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.note}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {doc.signedUrl ? (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                    {t("open")}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t("noLink")}
                  </span>
                )}
                {doc.canDelete && (
                  <ConfirmDialog
                    trigger={
                      <Button
                        disabled={loading}
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t("deleteAria")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                    title={tc("deleteDocTitle")}
                    description={tc("deleteDocBody", { name: doc.file_name })}
                    confirmLabel={tc("deleteDocConfirm")}
                    onConfirm={() => handleDelete(doc)}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div className="mt-2.5 space-y-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={loading}
            placeholder={t("notePlaceholder")}
            className="h-9 text-sm"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFile}
            disabled={loading}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {t("upload")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>
      )}
    </div>
  );
}
