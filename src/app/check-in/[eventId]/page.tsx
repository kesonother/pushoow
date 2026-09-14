import { notFound, redirect } from "next/navigation";
import { resolveActor } from "@/api/authorize";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { CheckInScanner } from "@/ui/check-in-scanner";
import { SiteHeader } from "@/ui/site-header";

export default async function CheckInEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await getSession();
  const { eventId } = await params;
  if (!session?.user) redirect(`/login?next=/check-in/${eventId}`);
  const { t } = await getI18n();
  const services = getServices();
  const event = await services.eventRepo.findById(eventId);
  if (!event || event.deletedAt) notFound();
  try {
    const actor = await resolveActor(
      services.access,
      session.user.id,
      event.organizationId,
      Boolean(session.user.emailVerified),
    );
    await services.checkin.counter(actor, eventId);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t.checkin.title}</h1>
        <CheckInScanner
          eventId={event.id}
          title={event.title}
          isPaid={event.isPaid}
          labels={t.checkin}
        />
      </main>
    </div>
  );
}
