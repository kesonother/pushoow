import { getServices } from "@/server/container";
import { presentTicketType } from "@/domain/public-api/present";

export default async function EmbedTicketPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const services = getServices();
  const event = await services.eventRepo.findById(eventId);
  if (!event || event.deletedAt || event.visibility === "private" || event.status === "draft") {
    return <main className="p-4 text-sm text-zinc-600">Billets indisponibles.</main>;
  }
  const tickets = (await services.tickets.listByEvent(event.id)).map(presentTicketType);

  return (
    <main className="min-h-full bg-white p-4 font-sans text-zinc-950">
      <p className="text-xs uppercase tracking-wide text-zinc-500">Billets</p>
      <h1 className="mt-1 text-lg font-semibold">{event.title}</h1>
      <ul className="mt-4 flex flex-col gap-2">
        {tickets.map((ticket) => (
          <li key={ticket.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <span>{ticket.name}</span>
            <span>{(ticket.priceCents / 100).toFixed(2)} {ticket.currency}</span>
          </li>
        ))}
      </ul>
      <a
        href={`/e/${event.slug}`}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white"
      >
        Réserver
      </a>
    </main>
  );
}
