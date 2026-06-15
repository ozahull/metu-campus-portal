import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type Club = {
  id: string;
  name: string;
  description: string | null;
};

/**
 * Premium, METU kırmızısı ışıma efektli kulüp kartı.
 * Hem dashboard ızgarasında hem de keşif sayfasında kullanılır.
 */
export function ClubCard({ club }: { club: Club }) {
  return (
    <Card className="group flex flex-col border-white/5 bg-zinc-900/50 transition-all duration-300 hover:-translate-y-1 hover:border-[#841515]/50 hover:shadow-[0_8px_30px_-8px_rgba(132,21,21,0.45)]">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-300 transition-colors group-hover:bg-[#841515]/20 group-hover:text-[#e7a3a3]">
            <Users className="size-4" />
          </span>
          <CardTitle className="text-base font-semibold text-white">
            {club.name}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <p className="text-sm text-zinc-400">
          {club.description
            ? club.description.slice(0, 100) +
              (club.description.length > 100 ? "…" : "")
            : "Bu kulüp için henüz bir açıklama eklenmemiş."}
        </p>
      </CardContent>

      <CardFooter>
        <Link
          href={`/clubs/${club.id}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full justify-between border-white/10 bg-transparent text-zinc-200 transition-colors hover:border-[#841515] hover:bg-[#841515] hover:text-white",
          )}
        >
          Kulübü İncele
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
