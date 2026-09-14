import QRCode from "qrcode";
import { notFound, redirect } from "next/navigation";
import { resolveActor } from "@/api/authorize";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { DoorList } from "@/ui/door-list";
import { SiteHeader } from "@/ui/site-header";

export default async function DoorListPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await getSession();
  const { eventId } = await params;
  if (!session?.user) redirect(`/login?next=/check-in/${eventId}/door-list`);
  const { t } = await getI18n();
  const services = getServices();
  const event = await services.eventRepo.findById(eventId);
  if (!event || event.deletedAt) notFound();
  let list;
  try {
    const actor = await resolveActor(
      services.access,
      session.user.id,
      event.organizationId,
      Boolean(session.user.emailVerified),
    );
    list = await services.checkin.doorList(actor, eventId);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  const guests = await Promise.all(
    list.guests.map(async (guest) => ({
      displayName: guest.displayName,
      ticketTypeName: guest.ticketTypeName,
      ticketCode: guest.ticketCode,
      quantity: guest.quantity,
      qrImage: guest.qrToken ? await QRCode.toDataURL(guest.qrToken, { margin: 1, width: 160 }) : null,
    })),
  );

  return (
    <div className="flex min-h-full flex-col">
      <div className="print:hidden">
        <SiteHeader t={t} signedIn />
      </div>
      <main id="content" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <DoorList title={list.title} guests={guests} />
      </main>
    </div>
  );
}
