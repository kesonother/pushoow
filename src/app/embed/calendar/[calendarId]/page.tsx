import { getServices } from "@/server/container";
import { presentEvent } from "@/domain/public-api/present";

export default async function EmbedCalendarPage({
  params,
}: {
  params: Promise<{ calendarId: string }>;
}) {
  const { calendarId } = await params;
  const services = getServices();
  const calendar = await services.calendarRepo.findById(calendarId);
  if (!calendar || calendar.deletedAt || calendar.visibility === "private") {
    return (
      <main className="p-4 text-sm text-zinc-600">
        Calendrier indisponible.
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
      <p className="text-xs uppercase tracking-wide text-zinc-500">Calendrier</p>
      <h1 className="mt-1 text-lg font-semibold">{calendar.name}</h1>
      <ul className="mt-4 flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-xl border border-zinc-200 p-3">
            <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer" className="font-medium underline">
              {event.title}
            </a>
            <p className="mt-1 text-sm text-zinc-600">
              {new Date(event.startsAt).toLocaleString(calendar.locale || "fr", { timeZone: event.timezone })}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
