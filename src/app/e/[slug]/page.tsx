import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/auth/session";
import { NotFoundError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { CalendarFollowButton } from "@/ui/calendar-follow-button";
import { Card } from "@/ui/card";
import { EventChat } from "@/ui/event-chat";
import { EventRegisterForm } from "@/ui/event-register-form";
import { EventRoster } from "@/ui/event-roster";
import { EventViewBeacon } from "@/ui/event-view-beacon";
import { SiteHeader } from "@/ui/site-header";

type PageProps = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  try {
    return await getServices().publicEvents.getView(slug);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const view = await load(slug);
  if (!view) return { title: "Event", robots: { index: false, follow: false } };
  return {
    title: view.event.title,
    description: view.event.description ?? view.event.title,
    alternates: { canonical: `/e/${view.event.slug}` },
    openGraph: {
      title: view.event.title,
      description: view.event.description ?? view.event.title,
      images: view.event.coverImageUrl ? [view.event.coverImageUrl] : undefined,
    },
  };
}

export default async function EventPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const { t } = await getI18n();
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
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn={Boolean(session?.user)} />
      <EventViewBeacon eventId={event.id} />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        {event.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImageUrl} alt="" className="h-48 w-full rounded-3xl object-cover sm:h-64" />
        ) : null}
        <header className="grid gap-2">
          <p className="text-sm uppercase tracking-wide text-zinc-500">{view.lifecycle}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{event.title}</h1>
          <p className="text-zinc-600">
            {event.startsAt.toLocaleString(undefined, { timeZone: event.timezone })} · {event.timezone}
          </p>
          {location ? <p className="text-zinc-600">{location}</p> : null}
          {view.remaining != null ? (
            <p className="text-sm text-zinc-500">
              {view.remaining} {t.event.remaining}
            </p>
          ) : null}
        </header>
        {view.descriptionHtml ? (
          <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: view.descriptionHtml }} />
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
                      ? ` · ${item.startsAt.toLocaleString(undefined, { timeZone: event.timezone })}`
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
              className="h-56 w-full rounded-2xl border border-zinc-200 sm:h-72"
              loading="lazy"
            />
            {view.mapUrl ? (
              <a className="mt-2 inline-block text-sm underline" href={view.mapUrl}>
                OpenStreetMap
              </a>
            ) : null}
          </section>
        ) : view.mapUrl ? (
          <a className="text-sm underline" href={view.mapUrl}>
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
