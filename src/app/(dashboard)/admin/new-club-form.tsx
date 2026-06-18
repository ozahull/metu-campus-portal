"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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

export function NewClubForm() {
  const t = useTranslations("admin.newClub");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const clubName = name.trim();
    if (clubName.length === 0) {
      toast.error(t("toasts.nameRequired"));
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from("clubs").insert({
      name: clubName,
      description: description.trim() || null,
    });

    setLoading(false);

    if (error) {
      toast.error(t("toasts.error", { message: error.message }));
      return;
    }

    toast.success(t("toasts.success"));
    setName("");
    setDescription("");
  }

  return (
    <Card className="w-full max-w-lg border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-xl text-white shadow-lg"
            style={{ backgroundColor: "#841515" }}
          >
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">
              {t("title")}
            </CardTitle>
            <CardDescription>
              {t("subtitle")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">{t("nameLabel")}</Label>
            <Input
              id="name"
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("descLabel")}</Label>
            <Textarea
              id="description"
              placeholder={t("descPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={5}
              className="resize-none"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={loading || name.trim().length === 0}
            className="w-full gap-2 font-medium text-white hover:opacity-90"
            style={{ backgroundColor: "#841515" }}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {loading ? t("submitting") : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
