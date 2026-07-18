"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarRange, FileText, Loader2, Printer, Trophy } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  appDateTimeFormat,
  appDayKey,
  DAY_MS,
  fromAppDateTimeInput,
} from "@/lib/datetime";

type ReportRow = {
  club_id: string;
  club_name: string;
  member_total: number;
  new_members: number;
  event_count: number;
  rsvp_total: number;
  checkin_total: number;
};

export function TermReport() {
  const t = useTranslations("admin.termReport");
  const locale = useLocale();

  // Varsayılan aralık kampüs (Istanbul) gününe göre — UTC "bugün" gece
  // 00:00-03:00 arasında bir gün geride kalıyordu (hydration farkı).
  const [start, setStart] = useState(() =>
    appDayKey(Date.now() - 120 * DAY_MS),
  );
  const [end, setEnd] = useState(() => appDayKey(Date.now()));
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const df = useMemo(
    () => appDateTimeFormat(locale, { dateStyle: "long" }),
    [locale],
  );
  const pf = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const totals = useMemo(() => {
    const base = {
      members: 0,
      newMembers: 0,
      events: 0,
      rsvp: 0,
      checkin: 0,
    };
    if (!rows) return base;
    for (const r of rows) {
      base.members += Number(r.member_total);
      base.newMembers += Number(r.new_members);
      base.events += Number(r.event_count);
      base.rsvp += Number(r.rsvp_total);
      base.checkin += Number(r.checkin_total);
    }
    return base;
  }, [rows]);

  const mostActive = useMemo(() => {
    if (!rows) return [];
    return [...rows]
      .filter((r) => Number(r.event_count) > 0)
      .sort(
        (a, b) =>
          Number(b.event_count) - Number(a.event_count) ||
          Number(b.checkin_total) - Number(a.checkin_total),
      )
      .slice(0, 3);
  }, [rows]);

  function rate(checkin: number, rsvp: number): string {
    if (rsvp <= 0) return "—";
    return pf.format(checkin / rsvp);
  }

  async function generate() {
    if (start > end) {
      toast.error(t("toasts.badRange"));
      return;
    }
    setLoading(true);
    const supabase = createClient();
    // Aralık sınırları kampüs günü başlangıcı/bitişi (Istanbul gece yarısı).
    const { data, error } = await supabase.rpc("analytics_term_report", {
      p_start: fromAppDateTimeInput(`${start}T00:00`),
      p_end: new Date(
        Date.parse(fromAppDateTimeInput(`${end}T00:00`)) + DAY_MS - 1,
      ).toISOString(),
    });
    setLoading(false);
    if (error) {
      console.error("[term-report] rapor hatası:", error);
      toast.error(t("toasts.error"));
      return;
    }
    setRows((data as ReportRow[]) ?? []);
    setGeneratedAt(new Date());
  }

  return (
    <div className="print-report space-y-6">
      {/* Kontroller — yazdırmada gizli */}
      <div className="print-hide flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="rep-start">{t("startDate")}</Label>
          <Input
            id="rep-start"
            type="date"
            value={start}
            max={end}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rep-end">{t("endDate")}</Label>
          <Input
            id="rep-end"
            type="date"
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button onClick={generate} disabled={loading} className="gap-1.5">
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarRange className="size-4" />
            )}
            {t("generate")}
          </Button>
          {rows && (
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="gap-1.5"
            >
              <Printer className="size-4" />
              {t("download")}
            </Button>
          )}
        </div>
      </div>

      {rows === null ? (
        <div className="print-hide flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t("hint")}</p>
        </div>
      ) : (
        <div className="space-y-6 rounded-xl border border-border bg-card p-6">
          {/* Rapor başlığı (okul kimliği + tarih aralığı + oluşturma tarihi) */}
          <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                KKK
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  {t("reportTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("range", {
                    start: df.format(new Date(fromAppDateTimeInput(`${start}T00:00`))),
                    end: df.format(new Date(fromAppDateTimeInput(`${end}T00:00`))),
                  })}
                </p>
              </div>
            </div>
            {generatedAt && (
              <p className="text-right text-xs text-muted-foreground">
                {t("generatedAt", { date: df.format(generatedAt) })}
              </p>
            )}
          </header>

          {/* Kampüs toplamları */}
          <section className="print-break">
            <h3 className="mb-3 text-sm font-semibold tracking-tight">
              {t("campusTotals")}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label={t("colClub")} value={nf.format(rows.length)} />
              <Stat label={t("members")} value={nf.format(totals.members)} />
              <Stat label={t("newMembers")} value={nf.format(totals.newMembers)} />
              <Stat label={t("events")} value={nf.format(totals.events)} />
              <Stat label={t("rsvp")} value={nf.format(totals.rsvp)} />
              <Stat
                label={t("attendanceRate")}
                value={rate(totals.checkin, totals.rsvp)}
              />
            </div>
          </section>

          {/* En aktif kulüpler */}
          {mostActive.length > 0 && (
            <section className="print-break">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Trophy className="size-4 text-primary" />
                {t("mostActive")}
              </h3>
              <ol className="space-y-1.5">
                {mostActive.map((r, i) => (
                  <li
                    key={r.club_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">
                        {r.club_name}
                      </span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {t("eventsCount", { count: Number(r.event_count) })}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Kulüp bazlı tablo */}
          <section className="print-break">
            <h3 className="mb-3 text-sm font-semibold tracking-tight">
              {t("perClub")}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{t("colClub")}</th>
                    <th className="px-2 py-2 text-right font-medium">
                      {t("members")}
                    </th>
                    <th className="px-2 py-2 text-right font-medium">
                      {t("newMembers")}
                    </th>
                    <th className="px-2 py-2 text-right font-medium">
                      {t("events")}
                    </th>
                    <th className="px-2 py-2 text-right font-medium">
                      {t("rsvp")}
                    </th>
                    <th className="px-2 py-2 text-right font-medium">
                      {t("checkin")}
                    </th>
                    <th className="py-2 pl-2 text-right font-medium">
                      {t("attendanceRate")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.club_id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-2 pr-3 font-medium">{r.club_name}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {nf.format(Number(r.member_total))}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {nf.format(Number(r.new_members))}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {nf.format(Number(r.event_count))}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {nf.format(Number(r.rsvp_total))}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {nf.format(Number(r.checkin_total))}
                      </td>
                      <td className="py-2 pl-2 text-right text-muted-foreground">
                        {rate(Number(r.checkin_total), Number(r.rsvp_total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-2xl font-bold tracking-tight text-primary">
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
