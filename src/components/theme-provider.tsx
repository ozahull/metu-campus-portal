"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * next-themes sarmalayıcısı. Root layout'ta <html> üzerinde `class` (dark/light)
 * yönetir; SSR'da flash olmaması için next-themes kendi script'ini enjekte eder
 * (<html suppressHydrationWarning> gerekir). Varsayılan sistem teması izlenir.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
