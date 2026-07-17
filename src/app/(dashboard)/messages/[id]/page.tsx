import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/shared/page-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  conversationIcon,
  conversationSubtitle,
  counterpartText,
  type ConversationRow,
} from "@/lib/messaging";
import { cn } from "@/lib/utils";
import { MessageThread, type ThreadMessage } from "./message-thread";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("messages");
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_my_conversations");
  const row = ((data ?? []) as ConversationRow[]).find(
    (r) => r.conversation_id === id,
  );
  return {
    title: row
      ? (counterpartText(row.counterpart_label, t) ?? t("title"))
      : t("title"),
  };
}

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("messages");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Kanal başlığı + erişim: satır list_my_conversations'ta yoksa kullanıcı bu
  // kanala erişemiyor (veya kanal yok) → inbox'a dön. RLS de ayrıca korur.
  const { data: convRaw, error: convError } = await supabase.rpc(
    "list_my_conversations",
  );
  if (convError) {
    console.error("[messages] list_my_conversations hatası:", convError);
  }
  const row = ((convRaw ?? []) as ConversationRow[]).find(
    (r) => r.conversation_id === id,
  );
  if (!row) redirect("/messages");

  // Tek yön kanal gerçeği: ADMIN_PRESIDENT'ta başkan okur ama yazamaz.
  const { data: canWriteRaw, error: canWriteError } = await supabase.rpc(
    "can_write_conversation",
    { p_conv: id },
  );
  if (canWriteError) {
    console.error("[messages] can_write_conversation hatası:", canWriteError);
  }
  const canWrite = canWriteRaw === true;

  // Son 200 mesaj. Embed FK (messages.sender_user_id → profiles) 4A'da mevcut;
  // DESC + limit ile en YENİ 200 alınır, kodda reverse ile kronolojiye döner.
  const { data: msgRaw, error: msgError } = await supabase
    .from("messages")
    .select("id, sender_user_id, body, created_at, sender:sender_user_id(full_name)")
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (msgError) {
    console.error("[messages] mesaj listesi hatası:", msgError);
  }
  const messages = ((msgRaw ?? []) as ThreadMessage[]).reverse();

  const Icon = conversationIcon(row.type);
  const title =
    counterpartText(row.counterpart_label, t) ?? t(`channelType.${row.type}`);

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          href="/messages"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-3 gap-1.5 text-muted-foreground",
          )}
        >
          <ArrowLeft className="size-4" />
          {t("backToInbox")}
        </Link>

        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {conversationSubtitle(row, t)}
            </p>
          </div>
        </div>
      </div>

      <MessageThread
        conversationId={id}
        currentUserId={user.id}
        canWrite={canWrite}
        initialMessages={messages}
      />
    </PageShell>
  );
}
