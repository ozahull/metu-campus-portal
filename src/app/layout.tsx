import type { Metadata } from "next";
import { Figtree, Gabarito, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SwRegister } from "@/components/pwa/sw-register";
import { Toaster } from "@/components/ui/sonner";

// Tipografi (R0): gövde yüzü Figtree (--font-sans), display yüzü Gabarito
// (--font-display, R1-R2 başlıklarında kullanılacak). next/font build'de
// self-host eder — harici <link>/@font-face YOK. latin-ext Türkçe glifleri.
const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  display: "swap",
});

const gabarito = Gabarito({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const brand = t("title");
  return {
    title: {
      default: brand,
      template: `%s · ${brand}`,
    },
    description: t("description"),
    // PWA (Aşama 5A): manifest linkini app/manifest.ts otomatik enjekte eder.
    // Burada yalnızca iOS "Ana Ekrana Ekle" metaları verilir — iOS 16.4+ web
    // push, standalone kurulu PWA'yı şart koşar (apple-mobile-web-app-capable).
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: t("appleTitle"),
    },
    // İkonlar dosya konvansiyonuyla: app/icon.svg (sekme), app/favicon.ico
    // (/favicon.ico 404 fix'i), app/apple-icon.png (180x180 full-bleed —
    // iOS "Ana Ekrana Ekle"). Elle icons.apple tanımı kaldırıldı: eski 192'lik
    // yuvarlak-şeffaf PNG apple-touch-icon için yanlış biçimdi ve dosya
    // konvansiyonuyla çift <link> üretiyordu.
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${figtree.variable} ${gabarito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
            <SwRegister />
            <Toaster richColors position="top-center" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
