import { getServices } from "@/server/container";

export default async function EmbedRsvpPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getServices().eventRepo.findById(eventId);
  if (!event || event.deletedAt || event.visibility === "private" || event.status === "draft") {
    return <main className="p-4 text-sm text-zinc-600">Événement indisponible.</main>;
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-white p-4 font-sans">
      <a
        href={`/e/${event.slug}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-5 text-sm font-medium text-white"
      >
        RSVP — {event.title}
      </a>
    </main>
  );
}
