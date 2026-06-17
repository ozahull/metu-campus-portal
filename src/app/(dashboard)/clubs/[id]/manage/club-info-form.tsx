"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Save, Ticket, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const IMAGE_BUCKET = "club-images";

// Public URL içinden bucket sonrası dosya yolunu çıkarır (eski dosyayı silmek için).
function storagePath(url: string | null): string | null {
  if (!url) return null;
  const marker = `/${IMAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

export type ClubInfo = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  vision: string | null;
  logo_url: string | null;
  cover_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_url: string | null;
  instagram_url: string | null;
  iban: string | null;
  ticket_enabled: boolean;
};

export function ClubInfoForm({ club }: { club: ClubInfo }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: club.name ?? "",
    category: club.category ?? "",
    description: club.description ?? "",
    vision: club.vision ?? "",
    logo_url: club.logo_url ?? "",
    cover_url: club.cover_url ?? "",
    contact_email: club.contact_email ?? "",
    contact_phone: club.contact_phone ?? "",
    whatsapp_url: club.whatsapp_url ?? "",
    instagram_url: club.instagram_url ?? "",
    iban: club.iban ?? "",
  });
  const [ticketEnabled, setTicketEnabled] = useState(club.ticket_enabled);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function orNull(v: string) {
    return v.trim() === "" ? null : v.trim();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (form.name.trim().length === 0) {
      toast.error("Kulüp adı boş olamaz.");
      return;
    }
    // Bilet sistemi açıkken IBAN zorunlu (ödeme yapılacak hesap olmadan satış anlamsız).
    if (ticketEnabled && orNull(form.iban) === null) {
      toast.error("Bilet sistemi açıkken IBAN zorunludur.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("clubs")
      .update({
        name: form.name.trim(),
        category: orNull(form.category),
        description: orNull(form.description),
        vision: orNull(form.vision),
        logo_url: orNull(form.logo_url),
        cover_url: orNull(form.cover_url),
        contact_email: orNull(form.contact_email),
        contact_phone: orNull(form.contact_phone),
        whatsapp_url: orNull(form.whatsapp_url),
        instagram_url: orNull(form.instagram_url),
        iban: orNull(form.iban),
        ticket_enabled: ticketEnabled,
      })
      .eq("id", club.id);

    setLoading(false);
    if (error) {
      toast.error(`Kaydedilemedi: ${error.message}`);
      return;
    }
    toast.success("Kulüp bilgileri güncellendi");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Kulüp Adı</Label>
          <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} disabled={loading} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Kategori</Label>
          <Input id="category" placeholder="Örn. Teknoloji" value={form.category} onChange={(e) => set("category", e.target.value)} disabled={loading} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Açıklama</Label>
        <Textarea id="description" rows={4} className="resize-none" value={form.description} onChange={(e) => set("description", e.target.value)} disabled={loading} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vision">Vizyon</Label>
        <Textarea id="vision" rows={3} className="resize-none" value={form.vision} onChange={(e) => set("vision", e.target.value)} disabled={loading} />
      </div>

      {/* Görseller: dosya yükleme (club-images public bucket) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ImageUploadField
          clubId={club.id}
          kind="logo"
          label="Logo"
          value={form.logo_url}
          onChange={(url) => set("logo_url", url)}
          disabled={loading}
        />
        <ImageUploadField
          clubId={club.id}
          kind="cover"
          label="Kapak Görseli"
          value={form.cover_url}
          onChange={(url) => set("cover_url", url)}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact_email">İletişim E-posta</Label>
          <Input id="contact_email" type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_phone">İletişim Telefon</Label>
          <Input id="contact_phone" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp_url">WhatsApp Linki</Label>
          <Input id="whatsapp_url" value={form.whatsapp_url} onChange={(e) => set("whatsapp_url", e.target.value)} disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="instagram_url">Instagram Linki</Label>
          <Input id="instagram_url" value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} disabled={loading} />
        </div>
      </div>

      {/* Bilet sistemi */}
      <div className="space-y-4 rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-white">
              <Ticket className="size-4 text-[#e7a3a3]" />
              Bilet Sistemi
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Açıldığında ücretli etkinliklerde IBAN'a dekont yüklemeli bilet
              akışı devreye girer.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={ticketEnabled}
            aria-label="Bilet sistemi aktif"
            disabled={loading}
            onClick={() => setTicketEnabled((v) => !v)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
              ticketEnabled ? "bg-[#841515]" : "bg-white/15",
            )}
          >
            <span
              className={cn(
                "inline-block size-4 transform rounded-full bg-white transition-transform",
                ticketEnabled ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="iban">
            IBAN {ticketEnabled && <span className="text-[#e7a3a3]">*</span>}
          </Label>
          <Input
            id="iban"
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            value={form.iban}
            onChange={(e) => set("iban", e.target.value)}
            disabled={loading}
            className="font-mono"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="gap-2 font-medium text-white hover:opacity-90"
        style={{ backgroundColor: "#841515" }}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {loading ? "Kaydediliyor…" : "Bilgileri Kaydet"}
      </Button>
    </form>
  );
}

function ImageUploadField({
  clubId,
  kind,
  label,
  value,
  onChange,
  disabled,
}: {
  clubId: string;
  kind: "logo" | "cover";
  label: string;
  value: string;
  // Yükleme başarılı olunca yeni public URL ile form state'ini günceller.
  onChange: (url: string) => void;
  disabled: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const supabase = createClient();

    // Path deseni storage policy tarafından zorunlu: klasör = club_id.
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${clubId}/${kind}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || undefined });

    if (uploadError) {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      toast.error(`Görsel yüklenemedi: ${uploadError.message}`);
      return;
    }

    // Bucket public — signed URL DEĞİL, public URL alınır.
    const {
      data: { publicUrl },
    } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);

    // clubs.logo_url / cover_url'e hemen yaz (UPDATE).
    const payload = kind === "logo" ? { logo_url: publicUrl } : { cover_url: publicUrl };
    const { error: updateError } = await supabase
      .from("clubs")
      .update(payload)
      .eq("id", clubId);

    if (updateError) {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      toast.error(`Kaydedilemedi: ${updateError.message}`);
      return;
    }

    // Eski dosyayı storage'dan temizle (opsiyonel; hata yutulur).
    const oldPath = storagePath(value);
    if (oldPath && oldPath !== path) {
      await supabase.storage.from(IMAGE_BUCKET).remove([oldPath]);
    }

    onChange(publicUrl);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    toast.success(`${label} güncellendi`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]",
          kind === "logo" ? "size-28" : "aspect-[16/6] w-full",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt={`${label} önizleme`}
            className="size-full object-cover"
          />
        ) : (
          <span className="inline-flex flex-col items-center gap-1 text-zinc-600">
            <ImageIcon className="size-6" />
            <span className="text-xs">Görsel yok</span>
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        disabled={disabled || uploading}
        className="hidden"
      />
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        size="sm"
        variant="outline"
        className="gap-1.5 border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {value ? "Değiştir" : "Görsel Yükle"}
      </Button>
    </div>
  );
}
