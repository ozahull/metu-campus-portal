import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/shared/page-shell";
import {
  NOTIFICATIONS_PAGE_SIZE,
  NOTIFICATION_COLS,
  NotificationsView,
} from "@/components/notifications-view";
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

  // Ölçek (Commit 1): TÜM bildirimleri tek sorguda çekmek yerine cursor tabanlı
  // ilk sayfa. Aktif kullanıcıda binlerce birikebilir; ilk yük hafif tutulur,
  // gerisi "daha fazla yükle" ile (bkz. NotificationsView). +1 çekilir: gelen
  // satır sayfa boyunu aşarsa daha fazlası VAR demektir (offset yok, keyset).
  const { data } = await supabase
    .from("notifications")
    .select(NOTIFICATION_COLS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(NOTIFICATIONS_PAGE_SIZE + 1);

  const rows = (data ?? []) as AppNotification[];
  const hasMore = rows.length > NOTIFICATIONS_PAGE_SIZE;
  const initialItems = rows.slice(0, NOTIFICATIONS_PAGE_SIZE);

  // Okunmamış sayısı AYRI hafif count sorgusuyla (head=true → satır getirmez).
  // "Tümünü okundu işaretle" görünürlüğü ve rozet bu otoritatif sayıdan gelir;
  // yüklenmiş sayfadaki `read_at` durumundan DEĞİL (okunmamış sonraki sayfada
  // olabilir).
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  return (
    <PageShell>
      <header className="mb-8 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Bell className="size-5" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      </header>

      <NotificationsView
        userId={user.id}
        initialItems={initialItems}
        initialHasMore={hasMore}
        initialUnread={count ?? 0}
      />
    </PageShell>
  );
}
