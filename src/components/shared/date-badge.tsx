import { cn } from "@/lib/utils";

/** Etkinlik kartlarında ay/gün blok tasarımı. */
export function DateBadge({
  date,
  locale,
  className,
}: {
  date: Date;
  locale: string;
  className?: string;
}) {
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
  const day = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date);
  return (
    <div
      className={cn(
        "flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-muted/60 leading-none",
        className,
      )}
    >
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
        {month}
      </span>
      <span className="mt-1 text-lg font-bold text-foreground">{day}</span>
    </div>
  );
}
