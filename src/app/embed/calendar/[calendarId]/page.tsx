import { formatEventDateTime } from "@/i18n/datetime";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { presentEvent } from "@/domain/public-api/present";
import { EmbedBeacon } from "@/ui/embed-beacon";

export default async function EmbedCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ calendarId: string }>;
  searchParams: Promise<{ track?: string }>;
}) {
  const { calendarId } = await params;
  const query = await searchParams;
  const track = query.track === "1";
  const { t, locale } = await getI18n();
  const services = getServices();
  const calendar = await services.calendarRepo.findById(calendarId);
  if (!calendar || calendar.deletedAt || calendar.visibility === "private") {
    return (
      <main className="p-4 text-sm text-zinc-600">
        {t.embed.unavailable}
      </main>
    );
  }
  const events = (await services.eventRepo.listByCalendar(calendar.id))
    .filter((item) => !item.deletedAt && item.visibility === "public" && item.status !== "draft")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 12)
    .map(presentEvent);

  return (
    <main className="min-h-full bg-white p-4 font-sans text-zinc-950">
      <EmbedBeacon kind="calendar" resourceId={calendar.id} track={track} />
      <p className="text-xs uppercase tracking-wide text-zinc-600">{t.embed.calendar}</p>
      <h1 className="mt-1 text-lg font-semibold">{calendar.name}</h1>
      <ul className="mt-4 flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-xl border border-[#E8E8E8] p-3">
            <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer" className="font-medium underline">
              {event.title}
            </a>
            <p className="mt-1 text-sm text-zinc-600">
              {formatEventDateTime(new Date(event.startsAt), event.timezone, locale)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
