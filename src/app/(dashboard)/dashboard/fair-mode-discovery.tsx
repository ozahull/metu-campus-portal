"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PartyPopper, Sparkles } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { JoinButton } from "../clubs/[id]/join-button";

export type FairClub = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  logo_url: string | null;
};

export function FairModeDiscovery({
  clubs,
  memberClubIds,
  userId,
  initialInterests,
}: {
  clubs: FairClub[];
  memberClubIds: string[];
  userId: string;
  initialInterests: string[];
}) {
  const t = useTranslations("fair");
  const memberSet = useMemo(() => new Set(memberClubIds), [memberClubIds]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of clubs) if (c.category) set.add(c.category);
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [clubs]);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialInterests.filter((i) => categories.includes(i))),
  );

  function toggle(cat: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      // URL'e yansıt (paylaşılabilir; sunucuya/DB'ye YAZILMAZ).
      const params = new URLSearchParams(window.location.search);
      if (next.size) params.set("interests", [...next].join(","));
      else params.delete("interests");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      );
      return next;
    });
  }

  const recommended = useMemo(() => {
    const base =
      selected.size > 0
        ? clubs.filter((c) => c.category && selected.has(c.category))
        : clubs;
    // Üye olunmayanlar önce (keşif amacı).
    return [...base].sort((a, b) => {
      const am = memberSet.has(a.id) ? 1 : 0;
      const bm = memberSet.has(b.id) ? 1 : 0;
      return am - bm;
    });
  }, [clubs, selected, memberSet]);

  return (
    <section className="mb-12 rounded-2xl border border-primary/25 bg-[radial-gradient(60%_80%_at_50%_0%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent)] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <PartyPopper className="size-5 text-primary" />
        <h2 className="text-xl font-bold tracking-tight">{t("title")}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

      {categories.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("noCategories")}
        </p>
      ) : (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("pickInterests")}
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const active = selected.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(cat)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/50",
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-tight">{t("forYou")}</h3>
      </div>

      {recommended.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={Sparkles} title={t("noMatch")} />
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recommended.map((c) => {
            const initials = c.name.slice(0, 2).toUpperCase();
            return (
              <li
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-sm font-bold text-foreground">
                    <ImageWithFallback
                      src={c.logo_url}
                      alt={c.name}
                      sizes="44px"
                      fallback={<span>{initials}</span>}
                    />
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/clubs/${c.id}`}
                      className="block truncate font-semibold tracking-tight transition-colors hover:text-primary"
                    >
                      {c.name}
                    </Link>
                    {c.category && (
                      <Badge variant="primary" className="mt-0.5">
                        {c.category}
                      </Badge>
                    )}
                  </div>
                </div>
                {c.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {c.description}
                  </p>
                )}
                <div className="mt-auto">
                  <JoinButton
                    clubId={c.id}
                    userId={userId}
                    isMember={memberSet.has(c.id)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
