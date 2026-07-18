"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { ClubCard, type Club } from "@/components/shared/club-card";
import { categoryLabel } from "@/lib/category";
import { normalizeSearchText, searchIncludes } from "@/lib/search-text";
import { cn } from "@/lib/utils";

/**
 * Kulüp koleksiyonu: opsiyonel canlı arama + kategori chip filtreleri + grid.
 * /clubs (arama açık) ve dashboard (yalnızca chip) tarafından paylaşılır.
 * Filtreleme yalnızca istemci tarafı (useMemo) — sunucu sorgusu değişmez.
 */
export function ClubsCollection({
  clubs,
  showSearch = false,
}: {
  clubs: Club[];
  showSearch?: boolean;
}) {
  const t = useTranslations("clubs");
  const tCategories = useTranslations("categories");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of clubs) if (c.category) set.add(c.category);
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [clubs]);

  const filtered = useMemo(() => {
    // Türkçe-güvenli arama (O18): "İnovasyon"/"IŞIK" gibi adlar Türkçe veya
    // ASCII klavye girişiyle de bulunur — bkz. src/lib/search-text.ts.
    const q = normalizeSearchText(query.trim());
    return clubs.filter((club) => {
      if (category && club.category !== category) return false;
      if (!q) return true;
      return (
        searchIncludes(club.name, q) || searchIncludes(club.description, q)
      );
    });
  }, [clubs, query, category]);

  return (
    <div className="space-y-6">
      {showSearch && (
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 rounded-full pl-11 text-base"
          />
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <CategoryChip
            label={t("allCategories")}
            active={category === ""}
            onClick={() => setCategory("")}
          />
          {/* Etiket çevrilir; filtre eşleşmesi HAM DB değeriyle kalır. */}
          {categories.map((c) => (
            <CategoryChip
              key={c}
              label={categoryLabel(c, tCategories) ?? c}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((club) => (
            <ClubCard key={club.id} club={club} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={SearchX}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      )}
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/50",
      )}
    >
      {label}
    </button>
  );
}
