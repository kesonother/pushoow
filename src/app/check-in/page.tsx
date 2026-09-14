import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { hasPermission } from "@/domain/rbac/permissions";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";

export default async function CheckInIndexPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login?next=/check-in");
  const { t } = await getI18n();
  const services = getServices();
  const accessible = await services.access.listAccessible(
    session.user.id,
    Boolean(session.user.emailVerified),
  );
  const events: Array<{ id: string; title: string; organizationId: string; startsAt: Date }> = [];
  for (const { actor } of accessible) {
    if (!hasPermission(actor, "checkin:manage")) continue;
    const list = await services.events.listEventsForOrganization(actor);
    events.push(
      ...list.map((event) => ({
        id: event.id,
        title: event.title,
        organizationId: event.organizationId,
        startsAt: event.startsAt,
      })),
    );
  }
  events.sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime());

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t.checkin.title}</h1>
        {events.length === 0 ? (
          <p className="text-zinc-600">{t.dashboard.empty}</p>
        ) : (
          <ul className="grid gap-3">
            {events.map((event) => (
              <li key={event.id}>
                <Card>
                  <Link className="text-lg font-medium underline" href={`/check-in/${event.id}`}>
                    {event.title}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
