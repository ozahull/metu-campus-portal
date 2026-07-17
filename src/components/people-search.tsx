"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog } from "@base-ui/react/dialog";
import { GraduationCap, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Genel kişi arama (Aşama 3C). Veri KAYNAĞI yalnızca search_public_profiles
 * RPC'sidir (SECURITY DEFINER): sadece KAMUSAL kişileri döndürür ve 2
 * karakterden kısa sorguda boş set verir — bu gizlilik kapısı DB'dedir,
 * client'ta ek profiles.select ile GENİŞLETME. RPC avatar/email/bio döndürmez
 * (arama kasıtlı hafif; ayrıntı /u/[id]'de get_profile ile).
 *
 * Desktop: navbar'da inline combobox + açılır sonuç listesi.
 * Mobil: arama ikonu → üstten açılan sheet (nav-mobile Dialog deseni).
 */

type PersonHit = {
  id: string;
  full_name: string;
  role: string;
  department: string | null;
};

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

function usePeopleSearch() {
  const [query, setQuery] = useState("");
  // null = boşta (hiç arama yok / < 2 karakter); [] = arandı ama sonuç yok.
  const [results, setResults] = useState<PersonHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  const trimmed = query.trim();

  useEffect(() => {
    // < 2 karakterde HİÇ istek atma (RPC de boş döner ama client hiç sormaz).
    if (trimmed.length < MIN_QUERY) {
      abortRef.current?.abort();
      seqRef.current++; // uçuştaki cevabı geçersiz kıl
      setResults(null);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++seqRef.current;

      const supabase = createClient();
      const { data, error } = await supabase
        .rpc("search_public_profiles", { p_query: trimmed })
        .abortSignal(controller.signal);

      // Stale-response guard: yalnızca EN SON istek UI'a yazar (son-istek-kazanır).
      if (seq !== seqRef.current) return;

      setLoading(false);
      if (error) {
        // abort normal akıştır; diğer hatalarda sessizce boş sonuç göster.
        if (!controller.signal.aborted) setResults([]);
        return;
      }
      setResults((data ?? []) as PersonHit[]);
      setActiveIndex(-1);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  function reset() {
    abortRef.current?.abort();
    seqRef.current++;
    setQuery("");
    setResults(null);
    setLoading(false);
    setActiveIndex(-1);
  }

  // Ok yukarı/aşağı gezinme + Enter seçim (Esc'i çağıran taraf ele alır).
  function onKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    onSelect: (hit: PersonHit) => void,
  ) {
    const items = results ?? [];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length) setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length)
        setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        onSelect(items[activeIndex]);
      }
    }
  }

  return {
    query,
    setQuery,
    trimmed,
    results,
    loading,
    activeIndex,
    setActiveIndex,
    reset,
    onKeyDown,
  };
}

type SearchState = ReturnType<typeof usePeopleSearch>;

/** Rol rozeti: yalnız ADVISOR ("Hoca") ve SUPER_ADMIN ("Yönetici"). USER'a
 *  rozet YOK — USER sonuçları başkanlık üzerinden kamusaldır ama bu hafif
 *  RPC'de başkanlık ilişkisi dönmez; "Öğrenci" yazıp yanıltmayalım. */
function RoleBadge({ role }: { role: string }) {
  const t = useTranslations("nav.search");
  const key = role?.toString().trim().toUpperCase();
  if (key === "ADVISOR") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
        <GraduationCap className="size-3" />
        {t("badgeAdvisor")}
      </span>
    );
  }
  if (key === "SUPER_ADMIN") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
        <ShieldCheck className="size-3" />
        {t("badgeAdmin")}
      </span>
    );
  }
  return null;
}

/** Sonuç listesi (listbox). Avatar bilinçli YOK (RPC döndürmez). */
function ResultsList({
  listId,
  search,
  onSelect,
}: {
  listId: string;
  search: SearchState;
  onSelect: (hit: PersonHit) => void;
}) {
  const t = useTranslations("nav.search");
  const { results, loading, activeIndex, setActiveIndex } = search;

  // Yeni harf yazılırken eski sonuçlar görünür kalır; yükleniyor satırı yalnız
  // gösterilecek sonuç yokken çıkar.
  if (loading && !results?.length) {
    return (
      <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t("loading")}
      </div>
    );
  }

  if (results && results.length === 0) {
    return (
      <p className="px-3 py-3 text-sm text-muted-foreground">
        {t("noResults")}
      </p>
    );
  }

  if (!results?.length) return null;

  return (
    <ul id={listId} role="listbox" aria-label={t("listLabel")}>
      {results.map((hit, i) => (
        <li
          key={hit.id}
          id={`${listId}-opt-${i}`}
          role="option"
          aria-selected={i === activeIndex}
          onMouseEnter={() => setActiveIndex(i)}
          onClick={() => onSelect(hit)}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
            i === activeIndex && "bg-accent",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {hit.full_name}
            </p>
            {hit.department && (
              <p className="truncate text-xs text-muted-foreground">
                {hit.department}
              </p>
            )}
          </div>
          <RoleBadge role={hit.role} />
        </li>
      ))}
    </ul>
  );
}

function SearchInput({
  search,
  listId,
  expanded,
  onSelect,
  onFocus,
  onEscape,
  autoFocus,
  className,
}: {
  search: SearchState;
  listId: string;
  expanded: boolean;
  onSelect: (hit: PersonHit) => void;
  onFocus?: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const t = useTranslations("nav.search");

  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
        {search.loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Search className="size-4" />
        )}
      </span>
      <input
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          search.activeIndex >= 0
            ? `${listId}-opt-${search.activeIndex}`
            : undefined
        }
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        value={search.query}
        onChange={(e) => search.setQuery(e.target.value)}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onEscape?.();
            return;
          }
          search.onKeyDown(e, onSelect);
        }}
        placeholder={t("placeholder")}
        className="h-9 w-full rounded-full border border-input bg-background pl-9 pr-3 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      />
    </div>
  );
}

/** Desktop: navbar içinde inline combobox + altına açılan sonuç paneli. */
function DesktopSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const search = usePeopleSearch();

  function select(hit: PersonHit) {
    search.reset();
    setOpen(false);
    router.push(`/u/${hit.id}`);
  }

  // Dışarı tıklayınca kapat.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // < 2 karakterde dropdown tamamen gizli (istek de atılmaz).
  const showPanel = open && search.trimmed.length >= MIN_QUERY;

  return (
    <div ref={wrapRef} className="relative hidden w-52 md:block lg:w-64">
      <SearchInput
        search={search}
        listId={listId}
        expanded={showPanel}
        onSelect={select}
        onFocus={() => setOpen(true)}
        onEscape={() => setOpen(false)}
      />
      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg">
          <ResultsList listId={listId} search={search} onSelect={select} />
        </div>
      )}
    </div>
  );
}

/** Mobil: arama ikonu → üstten açılan sheet (nav-mobile Dialog deseni). */
function MobileSearch() {
  const t = useTranslations("nav.search");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const search = usePeopleSearch();

  function select(hit: PersonHit) {
    setOpen(false);
    search.reset();
    router.push(`/u/${hit.id}`);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) search.reset();
      }}
    >
      <Dialog.Trigger
        aria-label={t("open")}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Search className="size-5" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup className="fixed inset-x-0 top-0 z-50 border-b border-border bg-card p-4 shadow-xl outline-none data-open:animate-in data-open:slide-in-from-top data-closed:animate-out data-closed:slide-out-to-top">
          <div className="flex items-center gap-2">
            <SearchInput
              search={search}
              listId={listId}
              expanded={search.trimmed.length >= MIN_QUERY}
              onSelect={select}
              autoFocus
              className="flex-1"
            />
            <Dialog.Close
              aria-label={t("close")}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <div className="mt-2 max-h-[60vh] overflow-y-auto">
            {search.trimmed.length < MIN_QUERY ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {t("minChars")}
              </p>
            ) : (
              <ResultsList listId={listId} search={search} onSelect={select} />
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PeopleSearch() {
  return (
    <>
      <DesktopSearch />
      <MobileSearch />
    </>
  );
}
