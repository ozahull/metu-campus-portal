import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Compass, MapPinOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("title") };
}

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <MapPinOff className="size-8" />
      </div>
      <p className="mt-6 text-6xl font-extrabold tracking-tight text-primary">
        404
      </p>
      <h1 className="mt-3 text-lg font-semibold">{t("title")}</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("body")}</p>
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ size: "lg" }), "mt-6 gap-2")}
      >
        <Compass className="size-4" />
        {t("cta")}
      </Link>
    </main>
  );
}
