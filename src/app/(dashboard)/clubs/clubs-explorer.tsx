"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ClubCard, type Club } from "@/components/shared/club-card";

export function ClubsExplorer({ clubs }: { clubs: Club[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter(
      (club) =>
        club.name.toLowerCase().includes(q) ||
        (club.description?.toLowerCase().includes(q) ?? false),
    );
  }, [clubs, query]);

  return (
    <div>
      {/* Arama kutusu */}
      <div className="relative mb-8 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          type="search"
          placeholder="Kulüp adı veya açıklamasında ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 border-white/10 bg-zinc-900/60 pl-10 text-base text-white placeholder:text-zinc-500"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((club) => (
            <ClubCard key={club.id} club={club} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
            <SearchX className="size-6" />
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-300">
            Aradığınız kriterlere uygun kulüp bulunamadı
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Farklı bir anahtar kelimeyle tekrar deneyin.
          </p>
        </div>
      )}
    </div>
  );
}
