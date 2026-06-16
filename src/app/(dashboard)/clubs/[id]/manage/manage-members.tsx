"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldMinus, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export type RosterMember = {
  user_id: string;
  role: string;
  full_name: string | null;
};

export function ManageMembers({
  clubId,
  members,
  canAssignAdmin,
}: {
  clubId: string;
  members: RosterMember[];
  // Başkan (ADMIN) atama/geri alma yalnızca danışman ve okula görünür.
  canAssignAdmin: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setRole(member: RosterMember, role: "ADMIN" | "MEMBER") {
    setBusyId(member.user_id);
    const supabase = createClient();
    const { error } = await supabase
      .from("club_members")
      .update({ role })
      .eq("club_id", clubId)
      .eq("user_id", member.user_id);

    setBusyId(null);
    if (error) {
      toast.error(`İşlem başarısız: ${error.message}`);
      return;
    }
    toast.success(
      role === "ADMIN" ? "Üye yönetici yapıldı" : "Yöneticilik geri alındı",
    );
    router.refresh();
  }

  async function removeMember(member: RosterMember) {
    if (!window.confirm(`${member.full_name ?? "Bu üye"} kulüpten çıkarılsın mı?`)) {
      return;
    }
    setBusyId(member.user_id);
    const supabase = createClient();
    const { error } = await supabase
      .from("club_members")
      .delete()
      .eq("club_id", clubId)
      .eq("user_id", member.user_id);

    setBusyId(null);
    if (error) {
      toast.error(`Çıkarılamadı: ${error.message}`);
      return;
    }
    toast.success("Üye çıkarıldı");
    router.refresh();
  }

  if (members.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center text-sm text-zinc-500">
        Bu kulübün henüz üyesi yok.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {members.map((m) => {
        const isAdmin = m.role.toUpperCase() === "ADMIN";
        const busy = busyId === m.user_id;
        return (
          <li
            key={m.user_id}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-300">
                <UserRound className="size-4" />
              </span>
              <span className="truncate text-sm font-medium text-zinc-200">
                {m.full_name ?? "İsimsiz Üye"}
              </span>
              {isAdmin && (
                <span className="rounded-full border border-[#841515]/30 bg-[#841515]/10 px-2 py-0.5 text-[10px] font-medium text-[#e7a3a3]">
                  YÖNETİCİ
                </span>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              {canAssignAdmin &&
                (isAdmin ? (
                  <Button onClick={() => setRole(m, "MEMBER")} disabled={busy} size="icon-sm" variant="ghost" className="text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Başkanlığı geri al">
                    <ShieldMinus className="size-4" />
                  </Button>
                ) : (
                  <Button onClick={() => setRole(m, "ADMIN")} disabled={busy} size="icon-sm" variant="ghost" className="text-zinc-400 hover:bg-white/5 hover:text-[#e7a3a3]" aria-label="Başkan yap">
                    <ShieldCheck className="size-4" />
                  </Button>
                ))}
              <Button onClick={() => removeMember(m)} disabled={busy} size="icon-sm" variant="ghost" className="text-zinc-400 hover:bg-red-500/10 hover:text-red-400" aria-label="Üyeyi çıkar">
                <UserX className="size-4" />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
