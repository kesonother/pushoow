import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/auth/session";
import { NotFoundError } from "@/domain/errors";
import { formatEventDateTime } from "@/i18n/datetime";
import { getI18n } from "@/i18n/server";
import { pluralize } from "@/i18n/plural";
import { getServices } from "@/server/container";
import { CalendarFollowButton } from "@/ui/calendar-follow-button";
import { Card } from "@/ui/card";
import { EventChat } from "@/ui/event-chat";
import { EventRegisterForm } from "@/ui/event-register-form";
import { EventRoster } from "@/ui/event-roster";
import { EventViewBeacon } from "@/ui/event-view-beacon";
import { eventJsonLd } from "@/domain/seo/schema";
import { eventPageMetadata } from "@/domain/seo/metadata";
import { JsonLd } from "@/ui/json-ld";
import { ReferralCard } from "@/ui/referral-card";
import { ShareEventCard } from "@/ui/share-event-card";
import { SiteHeader } from "@/ui/site-header";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ onboarding?: string }> };

async function load(slug: string) {
  try {
    return await getServices().publicEvents.getView(slug);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export async function generateStaticParams() {
  try {
    const slugs = await getServices().seo.indexableEventSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const view = await load(slug);
  if (!view) return { title: "Event", robots: { index: false, follow: false } };
  return eventPageMetadata(view.event, view.calendar);
}

export default async function EventPublicPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const { t, locale } = await getI18n();
  const session = await getSession();
  const view = await load(slug);
  if (!view) notFound();
  const { event } = view;
  const services = getServices();
  const following = session?.user
    ? Boolean(await services.follows.getFollow(session.user.id, view.calendar.id))
    : false;
  let recommended: Awaited<ReturnType<typeof services.discovery.recommend>> = [];
  try {
    recommended = await services.discovery.recommend({
      eventId: event.id,
      userId: session?.user?.id,
    });
  } catch {
    recommended = [];
  }
  const sharePath = `/e/${event.slug}`;
  const location =
    [event.venueName, event.venueAddress, event.customPinLabel, event.virtualUrl]
      .filter(Boolean)
      .join(" · ") || null;

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn={Boolean(session?.user)} />
      <JsonLd
        data={eventJsonLd({
          event,
          calendarName: view.calendar.name,
          remaining: view.remaining,
        })}
      />
      <EventViewBeacon eventId={event.id} />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
        {event.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImageUrl} alt="" className="h-48 w-full rounded-[10px] object-cover sm:h-64" />
        ) : null}
        {query.onboarding === "share" ? (
          <ShareEventCard
            path={sharePath}
            title={t.onboarding.shareTitle}
            copyLabel={t.onboarding.copyLink}
            copiedLabel={t.onboarding.copied}
          />
        ) : null}
        <header className="grid gap-2">
          <p className="text-sm uppercase tracking-wide text-zinc-600">{view.lifecycle}</p>
          <h1 className="text-[32px] font-extrabold tracking-tight text-[#111111] sm:text-[40px]">{event.title}</h1>
          <p className="text-zinc-600">
            {formatEventDateTime(event.startsAt, event.timezone, locale)} · {event.timezone}
          </p>
          {location ? <p className="text-zinc-600">{location}</p> : null}
          {view.remaining != null ? (
            <p className="text-sm text-zinc-600">
              {pluralize(locale, view.remaining, {
                zero: t.event.remainingZero,
                one: t.event.remainingOne,
                two: t.event.remainingTwo,
                few: t.event.remainingFew,
                many: t.event.remainingMany,
                other: t.event.remainingOther,
              })}
            </p>
          ) : null}
        </header>
        {view.descriptionHtml ? (
          <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: view.descriptionHtml }} />
        ) : null}
        {session?.user ? (
          <ReferralCard
            eventId={event.id}
            title={t.referral.attendeeTitle}
            body={t.referral.attendeeBody}
            copyLabel={t.referral.copy}
            copiedLabel={t.onboarding.copied}
            rewardLabel={t.referral.reward}
          />
        ) : null}
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t.event.register}</h2>
          <EventRegisterForm
            eventId={event.id}
            registrationMode={event.registrationMode}
            tickets={view.tickets.map((ticket) => ({
              id: ticket.id,
              name: ticket.name,
              priceCents: ticket.priceCents,
              currency: ticket.currency,
            }))}
            addOns={view.addOns.map((addOn) => ({
              id: addOn.id,
              name: addOn.name,
              priceCents: addOn.priceCents,
              currency: addOn.currency,
            }))}
            labels={{
              email: t.auth.email,
              submit: t.event.register,
              success: t.event.registerSuccess,
              password: t.event.registrationPassword,
              token: t.event.accessToken,
              coupon: t.event.coupon,
              quantity: t.event.quantity,
              anonymous: t.privacy.anonymousRsvp,
              appearOnRoster: t.privacy.appearOnRoster,
              captcha: t.privacy.captcha,
              addOns: t.event.addOns,
              ticketSubtotal: t.event.ticketSubtotal,
              tax: t.event.tax,
              platformFee: t.event.platformFee,
              total: t.event.total,
              quoteHint: t.event.quoteHint,
            }}
          />
        </Card>
        <EventRoster
          eventId={event.id}
          labels={{ title: t.privacy.roster, hidden: t.privacy.rosterHidden }}
        />
        {view.tickets.length > 0 ? (
          <section>
            <h2 className="mb-2 text-xl font-semibold">{t.event.tickets}</h2>
            <ul className="grid gap-2">
              {view.tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Card>
                    <strong>{ticket.name}</strong>
                    <p>
                      {(ticket.priceCents / 100).toFixed(2)} {ticket.currency}
                    </p>
                    {ticket.description ? <p className="text-sm text-zinc-600">{ticket.description}</p> : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {view.speakers.length > 0 ? (
          <section>
            <h2 className="mb-2 text-xl font-semibold">{t.event.speakers}</h2>
            <ul className="grid gap-2">
              {view.speakers.map((item) => (
                <li key={item.id}>
                  <Card>
                    <strong>{item.title}</strong>
                    {item.body ? <p>{item.body}</p> : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {view.agenda.length > 0 ? (
          <section>
            <h2 className="mb-2 text-xl font-semibold">{t.event.agenda}</h2>
            <ul className="grid gap-2">
              {view.agenda.map((item) => (
                <li key={item.id}>
                  <Card>
                    {item.title}
                    {item.startsAt
                      ? ` · ${formatEventDateTime(item.startsAt, event.timezone, locale)}`
                      : ""}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {view.faqs.length > 0 ? (
          <section>
            <h2 className="mb-2 text-xl font-semibold">{t.event.faq}</h2>
            {view.faqs.map((item) => (
              <Card key={item.id}>
                <strong>{item.title}</strong>
                {item.body ? <p>{item.body}</p> : null}
              </Card>
            ))}
          </section>
        ) : null}
        {event.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {event.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-zinc-100 px-3 py-1 text-sm">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        <section>
          <h2 className="mb-2 text-xl font-semibold">{t.event.organizer}</h2>
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Link className="font-semibold underline" href={`/c/${view.calendar.slug}`}>
                  {view.organizer?.displayName ?? view.calendar.name}
                </Link>
                {view.organizer?.bio ? <p className="mt-1 text-sm text-zinc-600">{view.organizer.bio}</p> : null}
              </div>
              <CalendarFollowButton
                calendarId={view.calendar.id}
                following={following}
                signedIn={Boolean(session?.user)}
                loginHref={`/login?next=/e/${event.slug}`}
                labels={{
                  follow: t.calendar.follow,
                  unfollow: t.calendar.unfollow,
                  login: t.calendar.followLogin,
                }}
              />
            </div>
          </Card>
        </section>
        {view.mapEmbedUrl ? (
          <section>
            <h2 className="mb-2 text-xl font-semibold">{t.event.map}</h2>
            <iframe
              title={event.customPinLabel ?? event.venueName ?? event.title}
              src={view.mapEmbedUrl}
              className="h-56 w-full rounded-xl border border-[#E8E8E8] sm:h-72"
              loading="lazy"
            />
            {view.mapUrl ? (
              <a className="mt-2 inline-block text-sm underline" href={view.mapUrl}>
                OpenStreetMap
              </a>
            ) : null}
          </section>
        ) : view.mapUrl ? (
          <a className="inline-flex min-h-11 items-center text-[13px] font-medium text-zinc-600 transition-opacity hover:opacity-70" href={view.mapUrl}>
            OpenStreetMap
          </a>
        ) : null}
        {session?.user ? (
          <Card>
            <EventChat
              eventId={event.id}
              labels={{
                title: t.event.chatTitle,
                restricted: t.event.chatRestricted,
                closed: t.event.chatClosed,
                message: t.event.chatMessage,
                send: t.event.chatSend,
                older: t.event.chatOlder,
                report: t.event.chatReport,
                reportReason: t.event.chatReportReason,
                delete: t.event.chatDelete,
                hardDelete: t.event.chatHardDelete,
                deleted: t.event.chatDeleted,
                member: t.event.chatMember,
                organizer: t.event.organizer,
                asOrganizer: t.event.chatAsOrganizer,
                unavailable: t.event.chatUnavailable,
              }}
            />
          </Card>
        ) : (
          <p className="text-sm text-zinc-600">{t.event.chatRestricted}</p>
        )}
        <nav className="flex flex-wrap gap-3 text-sm underline" aria-label={t.event.share}>
          <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(sharePath)}`}>
            LinkedIn
          </a>
          <a href={`https://x.com/intent/tweet?url=${encodeURIComponent(sharePath)}&text=${encodeURIComponent(event.title)}`}>
            X
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(sharePath)}`}>
            Email
          </a>
        </nav>
        {recommended.length > 0 || view.related.length > 0 ? (
          <section>
            <h2 className="mb-2 text-xl font-semibold">{t.discover.recommended}</h2>
            <ul className="grid gap-2">
              {(recommended.length > 0 ? recommended : view.related.map((item) => ({ event: item }))).map((item) => (
                <li key={item.event.id}>
                  <Link className="underline" href={`/e/${item.event.slug}`}>
                    {item.event.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
