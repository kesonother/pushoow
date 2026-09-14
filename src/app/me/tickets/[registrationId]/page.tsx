import QRCode from "qrcode";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";

export default async function TicketQrPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const session = await getSession();
  const { registrationId } = await params;
  if (!session?.user) redirect(`/login?next=/me/tickets/${registrationId}`);
  const { t } = await getI18n();
  let ticket;
  try {
    ticket = await getServices().analytics.attendeeTicket(session.user.id, registrationId);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }
  const qrImage = ticket.qrToken ? await QRCode.toDataURL(ticket.qrToken, { margin: 1, width: 240 }) : null;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
        <Link href="/me/tickets" className="text-sm underline">
          {t.me.tickets}
        </Link>
        <Card>
          <h1 className="text-2xl font-semibold">{ticket.title}</h1>
          <p className="mt-1 text-sm text-zinc-600">{ticket.ticketCode ?? ticket.registrationId}</p>
          {qrImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImage} alt="" className="mx-auto mt-6 size-56" />
          ) : (
            <p className="mt-6 text-sm text-zinc-600">—</p>
          )}
        </Card>
      </main>
    </div>
  );
}
