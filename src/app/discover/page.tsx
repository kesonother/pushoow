import type { Metadata } from "next";
import { Suspense } from "react";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { DiscoverExplorer } from "@/ui/discover-explorer";
import { PageShell } from "@/ui/page-shell";
import { pageLeadClass, pageTitleClass } from "@/ui/theme";

export const metadata: Metadata = {
  title: "Discover events",
  description: "Find public community events without knowing the organizer.",
  alternates: { canonical: "/discover" },
  openGraph: {
    title: "Discover events",
    description: "Find public community events without knowing the organizer.",
  },
  twitter: { card: "summary", title: "Discover events" },
};

export default async function DiscoverPage() {
  const { t } = await getI18n();
  const session = await getSession();

  return (
    <PageShell t={t} signedIn={Boolean(session?.user)} width="xl">
      <header className="grid gap-2">
        <h1 className={pageTitleClass}>{t.discover.title}</h1>
        <p className={pageLeadClass}>{t.discover.body}</p>
      </header>
      <Suspense fallback={<p>{t.common.loading}</p>}>
        <DiscoverExplorer labels={t.discover} />
      </Suspense>
    </PageShell>
  );
}
