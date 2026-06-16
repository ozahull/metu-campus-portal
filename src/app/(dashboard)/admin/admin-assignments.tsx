"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type Option = { id: string; label: string };

const selectClass =
  "h-9 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none focus-visible:border-[#841515] [&>option]:bg-zinc-900";

export function AdminAssignments({
  clubs,
  users,
}: {
  clubs: Option[];
  users: Option[];
}) {
  const router = useRouter();

  const [adminClub, setAdminClub] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  const [advClub, setAdvClub] = useState("");
  const [advUser, setAdvUser] = useState("");
  const [advBusy, setAdvBusy] = useState(false);

  async function assignClubAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!adminClub || !adminUser) {
      toast.error("Kulüp ve kullanıcı seçin.");
      return;
    }
    setAdminBusy(true);
    const supabase = createClient();
    // Üyelik satırını oluştur/güncelle ve ADMIN yap.
    const { error } = await supabase
      .from("club_members")
      .upsert(
        { club_id: adminClub, user_id: adminUser, role: "ADMIN" },
        { onConflict: "club_id,user_id" },
      );
    setAdminBusy(false);
    if (error) {
      toast.error(`Atama başarısız: ${error.message}`);
      return;
    }
    toast.success("Kulüp yöneticisi atandı");
    setAdminUser("");
    router.refresh();
  }

  async function assignAdvisor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!advClub) {
      toast.error("Kulüp seçin.");
      return;
    }
    setAdvBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("clubs")
      .update({ advisor_id: advUser || null })
      .eq("id", advClub);
    setAdvBusy(false);
    if (error) {
      toast.error(`Atama başarısız: ${error.message}`);
      return;
    }
    toast.success(advUser ? "Danışman atandı" : "Danışman kaldırıldı");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Kulüp yöneticisi atama */}
      <Card className="border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldCheck className="size-5 text-[#e7a3a3]" />
            Kulüp Yöneticisi Ata
          </CardTitle>
          <CardDescription>
            Bir kullanıcıyı seçilen kulübe ADMIN yapar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={assignClubAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-club">Kulüp</Label>
              <select id="admin-club" className={selectClass} value={adminClub} onChange={(e) => setAdminClub(e.target.value)} disabled={adminBusy}>
                <option value="">Seçin…</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user">Kullanıcı</Label>
              <select id="admin-user" className={selectClass} value={adminUser} onChange={(e) => setAdminUser(e.target.value)} disabled={adminBusy}>
                <option value="">Seçin…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={adminBusy} className="gap-2 font-medium text-white hover:opacity-90" style={{ backgroundColor: "#841515" }}>
              {adminBusy && <Loader2 className="size-4 animate-spin" />}
              Yönetici Yap
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danışman atama */}
      <Card className="border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <GraduationCap className="size-5 text-[#e7a3a3]" />
            Akademik Danışman Ata
          </CardTitle>
          <CardDescription>
            Kulübe akademik danışman atayın (boş bırakırsanız kaldırılır).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={assignAdvisor} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adv-club">Kulüp</Label>
              <select id="adv-club" className={selectClass} value={advClub} onChange={(e) => setAdvClub(e.target.value)} disabled={advBusy}>
                <option value="">Seçin…</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adv-user">Danışman</Label>
              <select id="adv-user" className={selectClass} value={advUser} onChange={(e) => setAdvUser(e.target.value)} disabled={advBusy}>
                <option value="">(Danışman yok)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={advBusy} className="gap-2 font-medium text-white hover:opacity-90" style={{ backgroundColor: "#841515" }}>
              {advBusy && <Loader2 className="size-4 animate-spin" />}
              Danışmanı Kaydet
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
