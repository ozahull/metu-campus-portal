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

const METU_RED = "#841515";

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
        <BarChart3 className="size-5 text-[#e7a3a3]" />
        <h2 className="text-xl font-bold tracking-tight text-white">{t("heading")}</h2>
      </header>

      {/* Metrik kartları */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metricDefs.map(({ key, labelKey, icon: Icon }) => (
          <Card
            key={key}
            className="border-white/5 bg-zinc-900/50 backdrop-blur transition-colors hover:border-[#841515]/40"
          >
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                <Icon className="size-3.5 text-[#e7a3a3]" />
                {t(labelKey)}
              </span>
              <span
                className="text-3xl font-bold tracking-tight"
                style={{ color: METU_RED }}
              >
                {overview ? overview[key].toLocaleString("tr-TR") : "—"}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Üye büyüme grafiği */}
      <Card className="border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <TrendingUp className="size-5 text-[#e7a3a3]" />
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
                      <stop offset="0%" stopColor={METU_RED} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={METU_RED} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#a1a1aa", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#a1a1aa", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "#fff",
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                    formatter={(value) => [value as number, t("tooltipNewMember")]}
                  />
                  <Area
                    type="monotone"
                    dataKey="new_members"
                    stroke={METU_RED}
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
      <Card className="border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <Users2 className="size-5 text-[#e7a3a3]" />
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
                  <tr className="border-b border-white/10 text-left text-xs text-zinc-400">
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
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="py-2.5 pr-3 font-medium text-white">
                        {c.club_name}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-300">
                        {Number(c.member_count).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-300">
                        {Number(c.event_count).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-300">
                        {Number(c.approved_event_count).toLocaleString("tr-TR")}
                      </td>
                      <td className="py-2.5 pl-3 text-right text-zinc-300">
                        {Number(c.total_checkins).toLocaleString("tr-TR")}
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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400">
        <Icon className="size-5" />
      </div>
      <p className="mt-3 text-sm text-zinc-500">{text}</p>
    </div>
  );
}
