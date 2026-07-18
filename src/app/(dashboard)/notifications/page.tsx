import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/shared/page-shell";
import { NotificationsView } from "@/components/notifications-view";
import type { AppNotification } from "@/lib/notification-meta";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: yalnızca kendi bildirimleri. Son 100 kayıt yeterli (arşiv değil).
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(100);

  return (
    <PageShell>
      <header className="mb-8 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Bell className="size-5" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      </header>

      <NotificationsView initialItems={(data ?? []) as AppNotification[]} />
    </PageShell>
  );
}
