import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { ExportButtons } from "@/ui/export-buttons";
import { SiteHeader } from "@/ui/site-header";

export default async function MyTicketsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login?next=/me/tickets");
  const { t } = await getI18n();
  const home = await getServices().analytics.attendeeHome(session.user.id, session.user.email);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <Link href="/me" className="text-sm underline">
          {t.me.title}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{t.me.tickets}</h1>
        <ExportButtons kind="attendee" label={t.dashboard.export} />
        <ul className="grid gap-3">
          {home.tickets.map((ticket) => (
            <li key={ticket.registrationId}>
              <Card>
                <p className="text-lg font-medium">{ticket.title}</p>
                <p className="text-sm text-zinc-600">
                  {ticket.ticketCode ?? ticket.registrationId} · {ticket.status}
                </p>
                <Link className="mt-2 inline-block text-sm underline" href={`/me/tickets/${ticket.registrationId}`}>
                  {t.me.qr}
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
