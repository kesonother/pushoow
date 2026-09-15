import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { EmbedBeacon } from "@/ui/embed-beacon";

export default async function EmbedRsvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ track?: string }>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  const track = query.track === "1";
  const { t } = await getI18n();
  const event = await getServices().eventRepo.findById(eventId);
  if (!event || event.deletedAt || event.visibility === "private" || event.status === "draft") {
    return <main className="p-4 text-sm text-zinc-600">{t.embed.unavailable}</main>;
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-white p-4 font-sans">
      <EmbedBeacon kind="rsvp" resourceId={event.id} track={track} />
      <a
        href={`/e/${event.slug}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-5 text-sm font-medium text-white"
      >
        {t.embed.rsvp} — {event.title}
      </a>
    </main>
  );
}
