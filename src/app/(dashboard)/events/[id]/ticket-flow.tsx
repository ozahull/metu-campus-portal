"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  BadgeCheck,
  Ban,
  Copy,
  Loader2,
  Ticket as TicketIcon,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ticketStatusMeta, formatPrice } from "@/lib/ticket-status";

export type MyTicket = {
  id: string;
  token: string;
  status: string;
  receipt_url: string | null;
};

type TicketFlowProps = {
  eventId: string;
  userId: string;
  clubIban: string | null;
  price: number | string | null;
  // Bilet alımının kapandığı an (deadline ya da etkinlik saati).
  closesAtISO: string;
  ticket: MyTicket | null;
};

const RECEIPT_BUCKET = "receipts";

export function TicketFlow({
  eventId,
  userId,
  clubIban,
  price,
  closesAtISO,
  ticket,
}: TicketFlowProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closed = new Date(closesAtISO).getTime() <= Date.now();

  async function buyTicket() {
    setLoading(true);
    const supabase = createClient();
    // Yalnızca event_id + user_id yazılır; status DB default PENDING_PAYMENT.
    const { error } = await supabase
      .from("tickets")
      .insert({ event_id: eventId, user_id: userId });
    setLoading(false);
    if (error) {
      toast.error(`Bilet alınamadı: ${error.message}`);
      return;
    }
    toast.success("Bilet talebiniz oluşturuldu. Ödeme yapıp dekontu yükleyin.");
    router.refresh();
  }

  async function cancelTicket() {
    if (!ticket) return;
    if (!window.confirm("Bilet talebinizi iptal etmek istiyor musunuz?")) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("tickets").delete().eq("id", ticket.id);
    setLoading(false);
    if (error) {
      toast.error(`İptal edilemedi: ${error.message}`);
      return;
    }
    toast.success("Bilet talebiniz iptal edildi.");
    router.refresh();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!ticket || !file) return;

    setLoading(true);
    const supabase = createClient();

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${eventId}/${userId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || undefined });

    if (uploadError) {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.error(`Dekont yüklenemedi: ${uploadError.message}`);
      return;
    }

    // Public URL DEĞİL — yalnızca dosya yolunu sakla; görüntüleme signed URL ile.
    const { error: rpcError } = await supabase.rpc("ticket_submit_receipt", {
      p_ticket_id: ticket.id,
      p_receipt_url: path,
    });

    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (rpcError) {
      toast.error(`Dekont kaydedilemedi: ${rpcError.message}`);
      return;
    }
    toast.success("Dekontunuz yüklendi, onay bekleniyor.");
    router.refresh();
  }

  function copyIban() {
    if (!clubIban) return;
    navigator.clipboard
      .writeText(clubIban)
      .then(() => toast.success("IBAN kopyalandı."))
      .catch(() => toast.error("Kopyalanamadı."));
  }

  const meta = ticket ? ticketStatusMeta(ticket.status) : null;

  // --- Henüz bilet yok: satın al ---
  if (!ticket) {
    return (
      <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-400">Bilet</p>
            <p className="text-2xl font-bold tracking-tight text-white">
              {formatPrice(price)}
            </p>
          </div>
          {closed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-400">
              <Ban className="size-4" />
              Bilet satışı kapandı
            </span>
          ) : (
            <Button
              onClick={buyTicket}
              disabled={loading}
              className="gap-1.5 font-medium text-white hover:opacity-90"
              style={{ backgroundColor: "#841515" }}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <TicketIcon className="size-4" />
              )}
              Bilet Al
            </Button>
          )}
        </div>
      </div>
    );
  }

  // --- Bilet var: duruma göre ---
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300">
          <TicketIcon className="size-4 text-[#e7a3a3]" />
          Biletiniz
        </p>
        {meta && (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
          >
            {meta.label}
          </span>
        )}
      </div>

      {/* Ödeme bekliyor / reddedildi → ödeme bilgisi + dekont yükle */}
      {(ticket.status === "PENDING_PAYMENT" || ticket.status === "REJECTED") && (
        <div className="mt-4 space-y-4">
          {ticket.status === "REJECTED" && (
            <p className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200/90">
              Dekontunuz reddedildi. Lütfen ödemenizi kontrol edip yeniden
              yükleyin.
            </p>
          )}

          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <p className="text-xs text-zinc-400">Ödenecek tutar</p>
            <p className="text-lg font-semibold text-white">
              {formatPrice(price)}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-zinc-400">IBAN</p>
                <p className="truncate font-mono text-sm text-zinc-200">
                  {clubIban ?? "Kulüp IBAN bilgisi tanımlı değil"}
                </p>
              </div>
              {clubIban && (
                <Button
                  onClick={copyIban}
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0 text-zinc-400 hover:bg-white/5 hover:text-white"
                  aria-label="IBAN kopyala"
                >
                  <Copy className="size-4" />
                </Button>
              )}
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFile}
              disabled={loading}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="gap-1.5 font-medium text-white hover:opacity-90"
                style={{ backgroundColor: "#841515" }}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Dekontu Yükle
              </Button>
              {ticket.status === "PENDING_PAYMENT" && (
                <Button
                  onClick={cancelTicket}
                  disabled={loading}
                  variant="outline"
                  className="gap-1.5 border-white/15 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
                >
                  <X className="size-4" />
                  Talebi İptal Et
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Görsel (JPG/PNG) veya PDF yükleyebilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* Onay bekliyor */}
      {ticket.status === "SUBMITTED" && (
        <p className="mt-4 text-sm text-zinc-400">
          Dekontunuz alındı. Kulüp yetkilisinin onayı bekleniyor.
        </p>
      )}

      {/* Onaylandı → QR */}
      {ticket.status === "APPROVED" && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG value={ticket.token} size={196} level="M" />
          </div>
          <p className="font-mono text-lg tracking-[0.3em] text-white">
            {ticket.token}
          </p>
          <p className="inline-flex items-center gap-1.5 text-sm text-emerald-300">
            <BadgeCheck className="size-4" />
            Bu QR kodu girişte gösterin.
          </p>
        </div>
      )}

      {/* Check-in yapıldı */}
      {ticket.status === "CHECKED_IN" && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-violet-300">
          <BadgeCheck className="size-4" />
          Girişiniz yapıldı. İyi eğlenceler!
        </p>
      )}
    </div>
  );
}
