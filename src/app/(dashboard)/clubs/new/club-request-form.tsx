"use client";
import { refreshAfterMutation } from "@/lib/refresh";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquareWarning,
  RotateCw,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel } from "@/lib/category";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ClubRequestDocuments,
  type ClubRequestDocument,
} from "./club-request-documents";

export type ClubRequestRecord = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  rationale: string | null;
  status: string;
  review_note: string | null;
  created_club_id: string | null;
  created_at: string;
};

export function ClubRequestForm({
  userId,
  existing,
  documents,
}: {
  userId: string;
  // Bu hocanın en son başvurusu (yoksa null). RLS yalnız kendi kaydını verir.
  existing: ClubRequestRecord | null;
  documents: ClubRequestDocument[];
}) {
  const router = useRouter();
  const t = useTranslations("clubRequest");
  const tCategories = useTranslations("categories");
  const locale = useLocale();

  // "Yeni başvuru yap"/"Yeniden başvur" → mevcut kayıt PENDING/APPROVED/REJECTED
  // olsa bile boş forma döndürür (bir hoca birden çok kulüp açabilir).
  const [freshForm, setFreshForm] = useState(false);

  const editingChanges =
    !freshForm && existing?.status === "CHANGES_REQUESTED";

  // CHANGES_REQUESTED'te form mevcut değerlerle dolu; diğer hâllerde boş.
  const [name, setName] = useState(editingChanges ? existing!.name : "");
  const [description, setDescription] = useState(
    editingChanges ? (existing!.description ?? "") : "",
  );
  const [category, setCategory] = useState(
    editingChanges ? (existing!.category ?? "") : "",
  );
  const [rationale, setRationale] = useState(
    editingChanges ? (existing!.rationale ?? "") : "",
  );
  const [loading, setLoading] = useState(false);

  function clearFields() {
    setName("");
    setDescription("");
    setCategory("");
    setRationale("");
  }

  function startFresh() {
    clearFields();
    setFreshForm(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim().length === 0) {
      toast.error(t("toasts.nameRequired"));
      return;
    }
    if (rationale.trim().length === 0) {
      toast.error(t("toasts.rationaleRequired"));
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (editingChanges && existing) {
      // CHANGES_REQUESTED → resubmit (aynı kaydı günceller, tekrar PENDING).
      const { error } = await supabase.rpc("club_request_resubmit", {
        p_request_id: existing.id,
        p_name: name.trim(),
        p_description: description.trim(),
        p_category: category.trim(),
        p_rationale: rationale.trim(),
      });
      setLoading(false);
      if (error) {
        console.error("[club-request] yeniden gönderim hatası:", error);
        toast.error(t("toasts.resubmitError"));
        return;
      }
      toast.success(t("toasts.resubmitted"));
      await refreshAfterMutation(router);
      return;
    }

    // Yeni başvuru (KAYIT YOK ya da APPROVED/REJECTED sonrası "fresh").
    const { error } = await supabase.rpc("club_request_submit", {
      p_name: name.trim(),
      p_description: description.trim(),
      p_category: category.trim(),
      p_rationale: rationale.trim(),
    });
    setLoading(false);
    if (error) {
      console.error("[club-request] başvuru hatası:", error);
      toast.error(t("toasts.submitError"));
      return;
    }
    toast.success(t("toasts.submitted"));
    // refresh sonrası server yeni PENDING kaydı döndürür → fresh'i kapat.
    setFreshForm(false);
    clearFields();
    await refreshAfterMutation(router);
  }

  // Etkin durum: fresh form ya da hiç kayıt yoksa düzenlenebilir "NEW" form.
  const status = freshForm || !existing ? "NEW" : existing.status;

  // ---- PENDING: salt-okunur özet ----
  if (status === "PENDING" && existing) {
    return (
      <div className="space-y-4">
        <StatusCard
          tone="pending"
          icon={<Clock className="size-5" />}
          title={t("pending.title")}
          body={t("pending.body")}
        >
          <dl className="space-y-3 border-t border-border pt-4 text-sm">
            <SummaryRow label={t("pending.nameLabel")} value={existing.name} />
            <SummaryRow
              label={t("pending.categoryLabel")}
              value={
                categoryLabel(existing.category, tCategories) ??
                t("pending.empty")
              }
            />
            <SummaryRow
              label={t("pending.descriptionLabel")}
              value={existing.description || t("pending.empty")}
            />
            <SummaryRow
              label={t("pending.rationaleLabel")}
              value={existing.rationale || t("pending.empty")}
            />
            <p className="pt-1 text-xs text-muted-foreground">
              {t("pending.submittedAt", {
                date: formatDateTime(existing.created_at, locale, "short"),
              })}
            </p>
          </dl>
        </StatusCard>

        <ClubRequestDocuments
          requestId={existing.id}
          userId={userId}
          canUpload
          documents={documents}
        />
      </div>
    );
  }

  // ---- APPROVED: başarı + kulübe link + yeni başvuru ----
  if (status === "APPROVED" && existing) {
    return (
      <StatusCard
        tone="success"
        icon={<CheckCircle2 className="size-5" />}
        title={t("approved.title")}
        body={t("approved.body", { name: existing.name })}
      >
        <div className="flex flex-wrap gap-2">
          {existing.created_club_id && (
            <Link
              href={`/clubs/${existing.created_club_id}`}
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              {t("approved.viewClub")}
              <ArrowRight className="size-4" />
            </Link>
          )}
          <Button onClick={startFresh} size="sm" variant="outline">
            {t("approved.newRequest")}
          </Button>
        </div>
      </StatusCard>
    );
  }

  // ---- REJECTED: red nedeni + yeniden başvur (yeni submit) ----
  if (status === "REJECTED" && existing) {
    return (
      <StatusCard
        tone="destructive"
        icon={<XCircle className="size-5" />}
        title={t("rejected.title")}
        body={t("rejected.body")}
      >
        {existing.review_note && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="mb-1 text-xs font-medium tracking-wide uppercase">
              {t("rejected.noteLabel")}
            </p>
            <p className="whitespace-pre-wrap break-words">
              {existing.review_note}
            </p>
          </div>
        )}
        <div className="mt-4">
          <Button onClick={startFresh} size="sm" className="gap-1.5">
            <RotateCw className="size-4" />
            {t("rejected.reapply")}
          </Button>
        </div>
      </StatusCard>
    );
  }

  // ---- NEW / CHANGES_REQUESTED: düzenlenebilir form ----
  return (
    <div className="space-y-4">
      {editingChanges && existing && (
        <StatusCard
          tone="warning"
          icon={<MessageSquareWarning className="size-5" />}
          title={t("changes.title")}
          body={t("changes.body")}
        >
          {existing.review_note && (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              <p className="mb-1 text-xs font-medium tracking-wide uppercase">
                {t("changes.noteLabel")}
              </p>
              <p className="whitespace-pre-wrap break-words">
                {existing.review_note}
              </p>
            </div>
          )}
        </StatusCard>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cr-name">{t("form.nameLabel")}</Label>
              <Input
                id="cr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("form.namePlaceholder")}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-category">{t("form.categoryLabel")}</Label>
              <Input
                id="cr-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={t("form.categoryPlaceholder")}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-desc">{t("form.descriptionLabel")}</Label>
              <Textarea
                id="cr-desc"
                rows={3}
                className="resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("form.descriptionPlaceholder")}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-rationale">{t("form.rationaleLabel")}</Label>
              <Textarea
                id="cr-rationale"
                rows={4}
                className="resize-none"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder={t("form.rationalePlaceholder")}
                disabled={loading}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={loading}
                className="gap-2 font-medium"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : editingChanges ? (
                  <RotateCw className="size-4" />
                ) : (
                  <Send className="size-4" />
                )}
                {editingChanges ? t("form.resubmit") : t("form.submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Belge yükleme yalnız kayıt varken (CHANGES_REQUESTED). Boş/yeni formda
          henüz request_id yok → hiç render edilmez. */}
      {editingChanges && existing && (
        <ClubRequestDocuments
          requestId={existing.id}
          userId={userId}
          canUpload
          documents={documents}
          emphasize
        />
      )}
    </div>
  );
}

type Tone = "pending" | "success" | "destructive" | "warning";

const TONE_ICON: Record<Tone, string> = {
  pending: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
};

function StatusCard({
  tone,
  icon,
  title,
  body,
  children,
}: {
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              TONE_ICON[tone],
            )}
          >
            {icon}
          </span>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </div>
        <CardDescription className="text-pretty">{body}</CardDescription>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-32 shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:pt-0.5">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-words whitespace-pre-wrap text-foreground">
        {value}
      </dd>
    </div>
  );
}
