import type { Metadata } from "next";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { FeaturedCalendars } from "@/ui/featured-calendars";
import { PageShell } from "@/ui/page-shell";
import { pageLeadClass, pageTitleClass } from "@/ui/theme";

export const metadata: Metadata = {
  title: "Featured calendars",
  description: "Public calendars that meet Pushoow featured eligibility.",
  alternates: { canonical: "/calendars" },
  openGraph: { title: "Featured calendars" },
  twitter: { card: "summary", title: "Featured calendars" },
};

export default async function FeaturedCalendarsPage() {
  const { t } = await getI18n();
  const session = await getSession();

  return (
    <PageShell t={t} signedIn={Boolean(session?.user)} width="content">
      <header className="grid gap-2">
        <h1 className={pageTitleClass}>{t.discover.featuredTitle}</h1>
        <p className={pageLeadClass}>{t.discover.featuredBody}</p>
      </header>
      <FeaturedCalendars labels={t.discover} />
    </PageShell>
  );
}
