"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GraduationCap, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { roleLabel } from "@/lib/role-label";
import { cn } from "@/lib/utils";

/**
 * Ölçek (Commit 2) — SUNUCU TARAFLI aranan/sayfalanan kullanıcı seçici.
 *
 * Eski /admin, atama dropdown'larını doldurmak için TÜM profilleri (5.000+, sabit
 * .limit(500)) çekiyordu → dropdown'lar %90 kör + ~2s. Bunun yerine burada:
 *  • arama SUNUCUDA `profiles ilike` (debounce'lu, tüm listeyi çekip client'ta
 *    filtreleme YOK),
 *  • sayfalama SUNUCUDA `.range()` (25/sayfa, "daha fazla"),
 *  • toplam sayı server tarafında `count:'exact'` ile (client saymaz).
 *
 * profiles SELECT (id, full_name, role) authenticated'a kolon-grant ile AÇIK
 * (email değil) → admin herhangi bir kullanıcıyı adıyla bulur. department/
 * class_year kolon-grant DIŞI olduğundan ayırt edicilik rol rozetiyle yapılır.
 */

export type PickedUser = { id: string; label: string };

type UserHit = { id: string; full_name: string | null; role: string | null };

const PAGE = 25;
const DEBOUNCE_MS = 250;

function roleKey(role: string | null): string {
  return role?.toString().trim().toUpperCase() ?? "";
}

/** Rol ipucu — yalnız ADVISOR/SUPER_ADMIN (aynı adlı kişileri ayırt eder).
 *  Etiketler merkezî roleLabel'dan (D24) — sayfa-yerel rol anahtarı açma. */
function RoleHint({ role }: { role: string | null }) {
  const t = useTranslations("roleLabels");
  const key = roleKey(role);
  if (key !== "ADVISOR" && key !== "SUPER_ADMIN") return null;
  const Icon = key === "SUPER_ADMIN" ? ShieldCheck : GraduationCap;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
      <Icon className="size-3" />
      {roleLabel(key, t)}
    </span>
  );
}

export function AdminUserPicker({
  value,
  onChange,
  roleFilter,
  disabled,
  inputId,
}: {
  value: PickedUser | null;
  onChange: (u: PickedUser | null) => void;
  /** Verilirse yalnız bu role'deki kullanıcılar aranır (ör. "USER"). */
  roleFilter?: string;
  disabled?: boolean;
  inputId?: string;
}) {
  const t = useTranslations("admin.userPicker");
  const tRole = useTranslations("admin.page");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserHit[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);
  const listId = useId();
  const genId = useId();
  const controlId = inputId ?? genId;

  const label = (u: UserHit) => u.full_name ?? tRole("unnamedUser");

  // Sunucudan bir sayfa çek (from = offset). Arama boşsa tüm kullanıcılar (isimle
  // sıralı) — "gözat" modu; aksi halde ilike filtresi. count:'exact' toplamı
  // server hesaplar (client tüm satırları saymaz).
  const fetchPage = useCallback(
    async (q: string, from: number) => {
      const supabase = createClient();
      let builder = supabase
        .from("profiles")
        .select("id, full_name, role", { count: "exact" })
        .order("full_name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (roleFilter) builder = builder.eq("role", roleFilter);
      const trimmed = q.trim();
      if (trimmed.length > 0) builder = builder.ilike("full_name", `%${trimmed}%`);
      return builder;
    },
    [roleFilter],
  );

  // Sorgu değişince (debounce) 0. sayfayı çek. seq guard: yalnız SON istek yazar.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = setTimeout(async () => {
      const seq = ++seqRef.current;
      const { data, count: total, error } = await fetchPage(query, 0);
      if (seq !== seqRef.current) return; // bayat cevap
      setLoading(false);
      if (error) {
        setResults([]);
        setCount(0);
        return;
      }
      setResults((data ?? []) as UserHit[]);
      setCount(total ?? 0);
      setActiveIndex(-1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, open, fetchPage]);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    const seq = seqRef.current;
    const { data, error } = await fetchPage(query, results.length);
    setLoadingMore(false);
    if (seq !== seqRef.current || error) return;
    const rows = (data ?? []) as UserHit[];
    setResults((prev) => {
      const seen = new Set(prev.map((x) => x.id));
      return [...prev, ...rows.filter((x) => !seen.has(x.id))];
    });
  }

  function pick(u: UserHit) {
    onChange({ id: u.id, label: label(u) });
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
  }

  function clear() {
    onChange(null);
    setOpen(true);
  }

  // Dışarı tıklayınca kapat.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length) setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length)
        setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        pick(results[activeIndex]);
      }
    }
  }

  // SEÇİLİ durum: isim çipi + temizle (X). Aramaya dönmek için X'e basılır.
  if (value) {
    return (
      <div
        className="flex h-9 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3"
        id={controlId}
      >
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {value.label}
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          aria-label={t("clear")}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  const showPanel = open;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
        </span>
        <input
          id={controlId}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          // text-base mobil: iOS Safari 16px altındaki input'a odakta kalıcı zoom
          // yapar — görsel küçüklük yalnız md+ (ui/input deseni).
          className="h-9 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
        />
      </div>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          {loading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("loading")}
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {t("noResults")}
            </p>
          ) : (
            <>
              <p className="border-b border-border px-3 py-1.5 text-[0.7rem] tracking-wide text-muted-foreground uppercase tabular-nums">
                {t("resultsCount", { count })}
              </p>
              <ul
                id={listId}
                role="listbox"
                className="max-h-64 overflow-y-auto"
              >
                {results.map((u, i) => (
                  <li
                    key={u.id}
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => pick(u)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 transition-colors",
                      i === activeIndex && "bg-accent",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {label(u)}
                    </span>
                    <RoleHint role={u.role} />
                  </li>
                ))}
              </ul>
              {results.length < count && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-border px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  {loadingMore && <Loader2 className="size-3.5 animate-spin" />}
                  {t("loadMore")}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
