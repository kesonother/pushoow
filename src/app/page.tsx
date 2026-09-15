import type { Metadata } from "next";
import { getSession } from "@/auth/session";
import { loadHomeFeed } from "@/domain/home/feed";
import { getI18n } from "@/i18n/server";
import { Landing } from "@/ui/home/landing";

export const metadata: Metadata = {
  title: "Pushoow",
  description: "Discover and host community events. Calendar-first, open by default.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Pushoow",
    description: "Discover and host community events.",
  },
  twitter: { card: "summary_large_image", title: "Pushoow" },
};

export default async function HomePage() {
  const { t, locale } = await getI18n();
  const session = await getSession();
  const feed = await loadHomeFeed(locale, t.homeLanding.defaultCity);

  return <Landing t={t} feed={feed} signedIn={Boolean(session?.user)} />;
}
