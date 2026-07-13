import Link from "next/link";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Club = {
  id: string;
  name: string;
  description: string | null;
  category?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  memberCount?: number | null;
};

/**
 * Tema-duyarlı kulüp kartı: kapak alanı + üste binen logo + kategori rozeti +
 * üye sayısı. Tüm kart tek bir Link (tıklanabilir). Ham renk YOK — token'lar.
 */
export function ClubCard({
  club,
  className,
}: {
  club: Club;
  className?: string;
}) {
  const t = useTranslations("clubs");
  const initials = club.name.slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/clubs/${club.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {/* Kapak */}
      <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-primary/25 via-muted to-muted">
        {club.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={club.cover_url}
            alt=""
            className="size-full object-cover"
          />
        )}
      </div>

      {/* Logo (kapağa binen) */}
      <div className="px-4">
        <div className="-mt-7 flex size-14 items-center justify-center overflow-hidden rounded-xl border-2 border-card bg-muted text-sm font-bold text-foreground shadow-sm">
          {club.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={club.logo_url}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 pt-2.5">
        <h3 className="font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
          {club.name}
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          {club.category && <Badge variant="primary">{club.category}</Badge>}
          {typeof club.memberCount === "number" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              {t("memberCount", { count: club.memberCount })}
            </span>
          )}
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">
          {club.description ? club.description : t("noDescription")}
        </p>
      </div>
    </Link>
  );
}
