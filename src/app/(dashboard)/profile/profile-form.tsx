"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ProfileForm({
  userId,
  initialName,
}: {
  userId: string;
  initialName: string;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [nameBusy, setNameBusy] = useState(false);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  async function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim().length < 3) {
      toast.error("Lütfen ad ve soyadınızı eksiksiz girin.");
      return;
    }
    setNameBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", userId);
    setNameBusy(false);
    if (error) {
      toast.error(`Güncellenemedi: ${error.message}`);
      return;
    }
    toast.success("İsim güncellendi");
    router.refresh();
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    setPwBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPwBusy(false);
    if (error) {
      toast.error(`Şifre güncellenemedi: ${error.message}`);
      return;
    }
    setPassword("");
    toast.success("Şifre güncellendi");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <UserRound className="size-4 text-[#e7a3a3]" />
            Ad Soyad
          </CardTitle>
          <CardDescription>Görünen adınızı güncelleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveName} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Ad Soyad</Label>
              <Input id="full-name" value={name} onChange={(e) => setName(e.target.value)} disabled={nameBusy} required />
            </div>
            <Button type="submit" disabled={nameBusy} className="gap-2 font-medium text-white hover:opacity-90" style={{ backgroundColor: "#841515" }}>
              {nameBusy && <Loader2 className="size-4 animate-spin" />}
              Kaydet
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <KeyRound className="size-4 text-[#e7a3a3]" />
            Şifre Değiştir
          </CardTitle>
          <CardDescription>Yeni bir şifre belirleyin (en az 6 karakter).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Yeni Şifre</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pwBusy}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={pwBusy} className="gap-2 font-medium text-white hover:opacity-90" style={{ backgroundColor: "#841515" }}>
              {pwBusy && <Loader2 className="size-4 animate-spin" />}
              Şifreyi Güncelle
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
