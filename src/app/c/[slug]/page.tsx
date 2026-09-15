import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/auth/session";
import { NotFoundError } from "@/domain/errors";
import { formatEventDateTime } from "@/i18n/datetime";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { CalendarFollowButton } from "@/ui/calendar-follow-button";
import { CalendarFollowPrefs } from "@/ui/calendar-follow-prefs";
import { CalendarJoinForm } from "@/ui/calendar-join-form";
import { CalendarNewsletterForm } from "@/ui/calendar-newsletter-form";
import { Card } from "@/ui/card";
import { JsonLd } from "@/ui/json-ld";
import { SiteHeader } from "@/ui/site-header";
import { calendarPageMetadata } from "@/domain/seo/metadata";
import { calendarJsonLd } from "@/domain/seo/schema";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function loadView(slug: string, userId?: string) {
  try {
    return await getServices().publicCalendars.getView(slug, userId);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export async function generateStaticParams() {
  try {
    const slugs = await getServices().seo.indexableCalendarSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const view = await loadView(slug);
  if (!view) {
    return { title: "Calendar", robots: { index: false, follow: false } };
  }
  return calendarPageMetadata(view.calendar);
}

export default async function CalendarPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const { t, locale } = await getI18n();
  const session = await getSession();
  const view = await loadView(slug, session?.user?.id);
  if (!view) notFound();

  const calendar = view.calendar;
  const accent = calendar.primaryColor ?? "#111111";
  const jsonLd = view.access === "full" ? calendarJsonLd({ calendar }) : null;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn={Boolean(session?.user)} />
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
        <header
          className="overflow-hidden rounded-xl border border-[#E8E8E8] bg-white"
          style={{ borderColor: accent }}
        >
          {calendar.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={calendar.bannerUrl} alt="" className="h-48 w-full object-cover" />
          ) : null}
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
            {calendar.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={calendar.logoUrl}
                alt=""
                className="h-20 w-20 rounded-xl border border-[#E8E8E8] object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-semibold text-white"
                style={{ background: accent }}
              >
                {calendar.name.slice(0, 1)}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{calendar.name}</h1>
              {calendar.description ? (
                <p className="mt-2 max-w-2xl text-zinc-600">{calendar.description}</p>
              ) : null}
              <p className="mt-2 text-sm text-zinc-600">
                {view.followerCount} {t.calendar.followers}
              </p>
            </div>
            {view.access === "full" ? (
              <CalendarFollowButton
                calendarId={calendar.id}
                following={view.following}
                signedIn={Boolean(session?.user)}
                loginHref={`/login?next=/c/${calendar.slug}`}
                labels={{
                  follow: t.calendar.follow,
                  unfollow: t.calendar.unfollow,
                  login: t.calendar.followLogin,
                }}
              />
            ) : null}
          </div>
        </header>

        {view.access === "join" ? (
          <Card>
            <h2 className="text-xl font-semibold">{t.calendar.joinTitle}</h2>
            <p className="mt-2 text-zinc-600">{t.calendar.joinBody}</p>
            {view.membership ? (
              <p className="mt-3 text-sm text-zinc-700">Status: {view.membership.status}</p>
            ) : null}
            <div className="mt-4">
              <CalendarJoinForm
                calendarId={calendar.id}
                tiers={view.tiers}
                signedIn={Boolean(session?.user)}
                loginHref={`/login?next=/c/${calendar.slug}`}
                labels={{
                  join: t.calendar.join,
                  login: t.calendar.joinLogin,
                  empty: t.calendar.joinEmpty,
                }}
              />
            </div>
          </Card>
        ) : (
          <>
            {view.followPreferences ? (
              <Card>
                <CalendarFollowPrefs
                  calendarId={calendar.id}
                  preferences={view.followPreferences}
                  labels={{
                    email: t.calendar.notifyEmail,
                    push: t.calendar.notifyPush,
                    sms: t.calendar.notifySms,
                  }}
                />
              </Card>
            ) : null}

            {view.tags.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label={t.common.tags}>
                {view.tags.map((tag) => (
                  <li key={tag} className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800">
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}

            {view.featured.length > 0 ? (
              <section>
                <h2 className="mb-3 text-xl font-semibold">{t.calendar.featured}</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {view.featured.map((event) => (
                    <li key={event.id}>
                      <Card>
                        <h3 className="font-medium">
                          <Link className="underline" href={`/e/${event.slug}`}>
                            {event.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-sm text-zinc-600">
                          {formatEventDateTime(event.startsAt, calendar.timezone, locale)}
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h2 className="mb-3 text-xl font-semibold">{t.calendar.upcoming}</h2>
              {view.eventsByMonth.length === 0 ? (
                <p className="text-zinc-600">—</p>
              ) : (
                view.eventsByMonth.map((group) => (
                  <div key={group.key} className="mb-6">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-600">
                      {group.label}
                    </h3>
                    <ul className="grid gap-3">
                      {group.events.map((event) => (
                        <li key={event.id}>
                          <Card>
                            <h4 className="font-medium">
                              <Link className="underline" href={`/e/${event.slug}`}>
                                {event.title}
                              </Link>
                            </h4>
                            {event.description ? (
                              <p className="mt-1 text-sm text-zinc-600">{event.description}</p>
                            ) : null}
                            <p className="mt-2 text-sm text-zinc-600">
                              {formatEventDateTime(event.startsAt, calendar.timezone, locale)}
                            </p>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </section>

            {view.map.openStreetMapUrl ? (
              <section>
                <h2 className="mb-3 text-xl font-semibold">{t.calendar.map}</h2>
                <Card>
                  {view.map.postalAddress ? <p>{view.map.postalAddress}</p> : null}
                  <a className="mt-2 inline-block text-sm underline" href={view.map.openStreetMapUrl}>
                    OpenStreetMap
                  </a>
                </Card>
              </section>
            ) : null}

            <Card>
              <h2 className="text-lg font-medium">{t.calendar.feeds}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t.calendar.feedHint}</p>
              <nav className="mt-3 flex flex-wrap gap-3 text-sm underline">
                <Link href={`/c/${calendar.slug}/feed/ics`}>{t.calendar.ics}</Link>
                <Link href={`/c/${calendar.slug}/feed/webcal`}>{t.calendar.webcal}</Link>
                <Link href={`/c/${calendar.slug}/feed/rss`}>{t.calendar.rss}</Link>
                <Link href={`/c/${calendar.slug}/feed/atom`}>{t.calendar.atom}</Link>
              </nav>
            </Card>

            <Card>
              <CalendarNewsletterForm
                calendarId={calendar.id}
                labels={{
                  title: t.calendar.newsletter,
                  email: t.calendar.newsletterEmail,
                  submit: t.calendar.subscribe,
                  success: t.calendar.newsletterSuccess,
                }}
              />
            </Card>

            {view.similar.length > 0 ? (
              <section>
                <h2 className="mb-3 text-xl font-semibold">{t.calendar.similar}</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {view.similar.map((item) => (
                    <li key={item.id}>
                      <Card>
                        <Link href={`/c/${item.slug}`} className="font-medium underline">
                          {item.name}
                        </Link>
                        {item.description ? (
                          <p className="mt-1 text-sm text-zinc-600">{item.description}</p>
                        ) : null}
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
