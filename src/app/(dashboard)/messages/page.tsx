import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/shared/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/datetime";
import {
  conversationIcon,
  conversationSubtitle,
  counterpartText,
  type ConversationRow,
} from "@/lib/messaging";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("messages");
  return { title: t("title") };
}

export default async function MessagesPage() {
  const t = await getTranslations("messages");
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Erişilebilir MEVCUT kanallar + son mesaj + okunmamış sayısı — tek RPC
  // (list_my_conversations zaten last_message_at DESC sıralı döner).
  const { data, error } = await supabase.rpc("list_my_conversations");
  if (error) {
    console.error("[messages] list_my_conversations hatası:", error);
  }
  const rows = (data ?? []) as ConversationRow[];

  return (
    <PageShell>
      <header className="mb-8 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <MessagesSquare className="size-5" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={t("empty")}
          description={t("emptyHint")}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const Icon = conversationIcon(row.type);
            const title =
              counterpartText(row.counterpart_label, t) ??
              t(`channelType.${row.type}`);
            const unread = row.unread_count > 0;
            const badge =
              row.unread_count > 99 ? "99+" : String(row.unread_count);

            return (
              <li key={row.conversation_id}>
                <Link
                  href={`/messages/${row.conversation_id}`}
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      unread
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm",
                        unread ? "font-semibold" : "font-medium",
                      )}
                    >
                      {title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {conversationSubtitle(row, t)}
                    </span>
                    {row.last_message_preview && (
                      <span className="mt-1 line-clamp-1 block text-sm text-muted-foreground">
                        {row.last_message_preview}
                      </span>
                    )}
                  </span>

                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    {row.last_message_at && (
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTime(row.last_message_at, locale, "short")}
                      </span>
                    )}
                    {unread && (
                      <span
                        aria-label={t("unreadBadgeAria", {
                          count: row.unread_count,
                        })}
                        className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground"
                      >
                        {badge}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
