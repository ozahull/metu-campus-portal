"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  SlidersHorizontal,
  UserCog,
} from "lucide-react";
import { AdminTabs, AdminTabsList, AdminTab, AdminTabPanel } from "./admin-tabs";
import { AdminOverview } from "./admin-overview";
import { AdminApprovals, type PendingEvent } from "./admin-approvals";
import { AdminSettings, type ClubSetting } from "./admin-settings";
import { NewClubForm } from "./new-club-form";
import { AdminAssignments, type Option } from "./admin-assignments";
import { AdminRoles } from "./admin-roles";
import {
  AdminAnalytics,
  type ClubStat,
  type MemberGrowthPoint,
  type Overview,
} from "./admin-analytics";
import { TermReport } from "./term-report";

/**
 * Yönetim paneli Dil B kabuğu: sol sidebar navigasyon + sağ içerik. Tabs
 * CONTROLLED (value/state) — "Genel Bakış → tümü" linki Onay Kuyruğu sekmesine
 * programatik geçebilsin diye. Server sayfası veriyi prop olarak geçer; paneller
 * (client) aynı kalır. surface-admin sınıfı sayfa kökünde (AdminSurface).
 */
export function AdminShell({
  overview,
  pending,
  clubSettings,
  clubStats,
  memberGrowth,
  clubOptions,
  userOptions,
  clubAdvisors,
  roleCandidates,
  advisors,
  fairEnabled,
  userId,
}: {
  overview: Overview | null;
  pending: PendingEvent[];
  clubSettings: ClubSetting[];
  clubStats: ClubStat[];
  memberGrowth: MemberGrowthPoint[];
  clubOptions: Option[];
  userOptions: Option[];
  clubAdvisors: Record<string, string | null>;
  roleCandidates: Option[];
  advisors: Option[];
  fairEnabled: boolean;
  userId: string;
}) {
  const t = useTranslations("admin.page");
  const locale = useLocale();
  const [tab, setTab] = useState("overview");
  const pendingCount = pending.length;

  return (
    <AdminTabs value={tab} onValueChange={(v) => setTab(v as string)}>
      <AdminTabsList>
        <AdminTab value="overview">
          <LayoutDashboard />
          {t("tabOverview")}
        </AdminTab>
        <AdminTab value="approvals">
          <ClipboardCheck />
          {t("tabApprovals")}
          {pendingCount > 0 && (
            <span className="ml-auto rounded-full bg-primary/10 px-1.5 text-xs text-primary tabular-nums">
              {pendingCount}
            </span>
          )}
        </AdminTab>
        <AdminTab value="clubs">
          <Building2 />
          {t("tabClubs")}
        </AdminTab>
        <AdminTab value="assignments">
          <UserCog />
          {t("tabAssignments")}
        </AdminTab>
        <AdminTab value="analytics">
          <BarChart3 />
          {t("tabAnalytics")}
        </AdminTab>
        <AdminTab value="report">
          <FileText />
          {t("tabReport")}
        </AdminTab>
        <AdminTab value="settings">
          <SlidersHorizontal />
          {t("tabSettings")}
        </AdminTab>
      </AdminTabsList>

      <div className="min-w-0 flex-1">
        <AdminTabPanel value="overview">
          <AdminOverview
            overview={overview}
            pending={pending}
            pendingCount={pendingCount}
            fairEnabled={fairEnabled}
            onSeeApprovals={() => setTab("approvals")}
          />
        </AdminTabPanel>

        <AdminTabPanel value="approvals">
          <AdminApprovals pending={pending} userId={userId} />
        </AdminTabPanel>

        <AdminTabPanel value="clubs">
          <div className="space-y-6">
            <NewClubForm />
            {clubStats.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold tracking-tight">
                  {t("clubsListTitle")}
                </h2>
                <div className="overflow-x-auto rounded-lg border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                        <th className="px-4 py-2.5 font-medium">
                          {t("colClub")}
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          {t("colMembers")}
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          {t("colEvents")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {clubStats.map((c) => (
                        <tr
                          key={c.club_id}
                          className="border-b border-border transition-colors last:border-0 hover:bg-secondary/40"
                        >
                          <td className="px-4 py-2.5 font-medium">
                            {c.club_name}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                            {Number(c.member_count).toLocaleString(locale)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                            {Number(c.event_count).toLocaleString(locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </AdminTabPanel>

        <AdminTabPanel value="assignments">
          <div className="space-y-6">
            <AdminAssignments
              clubs={clubOptions}
              users={userOptions}
              clubAdvisors={clubAdvisors}
            />
            <AdminRoles candidates={roleCandidates} advisors={advisors} />
          </div>
        </AdminTabPanel>

        <AdminTabPanel value="analytics">
          <AdminAnalytics
            overview={overview}
            clubs={clubStats}
            growth={memberGrowth}
          />
        </AdminTabPanel>

        <AdminTabPanel value="report">
          <TermReport />
        </AdminTabPanel>

        <AdminTabPanel value="settings">
          <AdminSettings clubs={clubSettings} />
        </AdminTabPanel>
      </div>
    </AdminTabs>
  );
}
