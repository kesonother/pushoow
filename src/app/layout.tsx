import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getI18n } from "@/i18n/server";
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
  title: "Pushoow",
  description: "Calendar-first community events for tech, startup, and creator communities.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dir, t } = await getI18n();

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <SkipLink label={t.skipToContent} />
        {children}
      </body>
    </html>
  );
}
