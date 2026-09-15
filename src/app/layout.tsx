import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import { publicOrigin } from "@/lib/public-url";
import { SkipLink } from "@/ui/skip-link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(publicOrigin()),
  title: {
    default: "Pushoow",
    template: "%s · Pushoow",
  },
  description: "Calendar-first community events for tech, startup, and creator communities.",
  openGraph: {
    type: "website",
    siteName: "Pushoow",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir, t } = await getI18n();

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <I18nProvider locale={locale} messages={t}>
          <SkipLink label={t.skipToContent} />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
