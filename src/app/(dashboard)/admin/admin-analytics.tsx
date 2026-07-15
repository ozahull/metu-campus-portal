"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  LineChart as LineChartIcon,
  Ticket,
  TrendingUp,
  UserCheck,
  Users,
  Users2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type Overview = {
  total_clubs: number;
  total_members: number;
  total_events: number;
  approved_events: number;
  total_tickets: number;
  total_checkins: number;
};

export type ClubStat = {
  club_id: string;
  club_name: string;
  member_count: number;
  event_count: number;
  approved_event_count: number;
  total_checkins: number;
};

export type MemberGrowthPoint = {
  month: string;
  new_members: number;
};

// Grafik renkleri tema token'larından (CSS değişkenleri) türetilir — recharts
// SVG'de var(...) çözülür, böylece açık/koyu temada da doğru okunur.
const CHART_PRIMARY = "var(--primary)";
const CHART_AXIS = "var(--muted-foreground)";
const CHART_GRID = "var(--border)";

const metricDefs: {
  key: keyof Overview;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "total_clubs", labelKey: "metricClubs", icon: Users2 },
  { key: "total_members", labelKey: "metricMembers", icon: Users },
  { key: "total_events", labelKey: "metricEvents", icon: CalendarDays },
  { key: "approved_events", labelKey: "metricApproved", icon: CalendarCheck },
  { key: "total_tickets", labelKey: "metricTickets", icon: Ticket },
  { key: "total_checkins", labelKey: "metricCheckins", icon: UserCheck },
];

// "YYYY-MM" → locale'e göre kısa ay + yıl (örn. "Oca 2026" / "Jan 2026").
function formatMonth(ym: string, locale: string): string {
  const [y, m] = ym.split("-");
  const idx = Number.parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11 || !y) return ym;
  return new Date(Number(y), idx, 1).toLocaleDateString(locale, {
    month: "short",
    year: "numeric",
  });
}

export function AdminAnalytics({
  overview,
  clubs,
  growth,
}: {
  overview: Overview | null;
  clubs: ClubStat[];
  growth: MemberGrowthPoint[];
}) {
  const t = useTranslations("admin.analytics");
  const locale = useLocale();
  const chartData = growth.map((g) => ({
    month: formatMonth(g.month, locale),
    new_members: Number(g.new_members),
  }));

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-2">
        <BarChart3 className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold tracking-tight">{t("heading")}</h2>
      </header>

      {/* Metrik kartları (Dil B: nötr sayı öne, UPPERCASE etiket, tabular-nums) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metricDefs.map(({ key, labelKey, icon: Icon }) => (
          <Card key={key}>
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                <Icon className="size-3.5" />
                {t(labelKey)}
              </span>
              <span className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                {overview ? overview[key].toLocaleString(locale) : "—"}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Üye büyüme grafiği */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="size-4 text-muted-foreground" />
            {t("growthTitle")}
          </CardTitle>
          <CardDescription>
            {t("growthDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState
              icon={LineChartIcon}
              text={t("growthEmpty")}
            />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="memberFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_GRID}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: CHART_AXIS, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART_GRID }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: CHART_AXIS, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                    formatter={(value) => [value as number, t("tooltipNewMember")]}
                  />
                  <Area
                    type="monotone"
                    dataKey="new_members"
                    stroke={CHART_PRIMARY}
                    strokeWidth={2}
                    fill="url(#memberFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kulüp performans tablosu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users2 className="size-4 text-muted-foreground" />
            {t("clubsTitle")}
          </CardTitle>
          <CardDescription>
            {t("clubsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clubs.length === 0 ? (
            <EmptyState icon={Users2} text={t("clubsEmpty")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                    <th className="py-2 pr-3 font-medium">{t("colClub")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("colMember")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("colEvent")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("colApproved")}</th>
                    <th className="py-2 pl-3 text-right font-medium">{t("colCheckin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {clubs.map((c) => (
                    <tr
                      key={c.club_id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-secondary/40"
                    >
                      <td className="py-2.5 pr-3 font-medium">{c.club_name}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                        {Number(c.member_count).toLocaleString(locale)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                        {Number(c.event_count).toLocaleString(locale)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                        {Number(c.approved_event_count).toLocaleString(locale)}
                      </td>
                      <td className="py-2.5 pl-3 text-right text-muted-foreground tabular-nums">
                        {Number(c.total_checkins).toLocaleString(locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
