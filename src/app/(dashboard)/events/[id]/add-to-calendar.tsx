"use client";

import { CalendarPlus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description: string | null;
  location: string | null;
  startISO: string;
  // Bitiş yoksa başlangıç + 2 saat varsayılır.
  endISO?: string;
};

// Date → ICS/Google biçimi: YYYYMMDDTHHMMSSZ (UTC)
function toCalendar(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function AddToCalendar({ title, description, location, startISO, endISO }: Props) {
  const start = toCalendar(startISO);
  const end = toCalendar(
    endISO ?? new Date(new Date(startISO).getTime() + 2 * 60 * 60 * 1000).toISOString(),
  );

  const googleUrl =
    "https://www.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${start}/${end}` +
    `&details=${encodeURIComponent(description ?? "")}` +
    `&location=${encodeURIComponent(location ?? "")}`;

  function downloadIcs() {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ODTU KKK//Kampus Portali//TR",
      "BEGIN:VEVENT",
      `UID:${start}-${Math.random().toString(36).slice(2)}@metu-campus`,
      `DTSTAMP:${toCalendar(new Date().toISOString())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${title.replace(/\n/g, " ")}`,
      `DESCRIPTION:${(description ?? "").replace(/\n/g, " ")}`,
      `LOCATION:${(location ?? "").replace(/\n/g, " ")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-transparent px-3 text-sm font-medium text-zinc-200 transition-colors hover:border-[#841515] hover:bg-[#841515] hover:text-white"
      >
        <CalendarPlus className="size-4" />
        Google Takvim
      </a>
      <Button
        onClick={downloadIcs}
        variant="outline"
        size="lg"
        className="gap-2 border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
      >
        <Download className="size-4" />
        .ics indir
      </Button>
    </div>
  );
}
