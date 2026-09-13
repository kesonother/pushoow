export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    weekday: weekdayMap[read("weekday")] ?? 0,
  };
}

export function zonedInstant(
  parts: Pick<ZonedParts, "year" | "month" | "day" | "hour" | "minute">,
  timeZone: string,
): Date {
  let guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = zonedParts(guess, timeZone);
    const deltaMinutes =
      (((parts.year - current.year) * 12 + (parts.month - current.month)) * 31 +
        (parts.day - current.day)) *
        24 *
        60 +
      (parts.hour - current.hour) * 60 +
      (parts.minute - current.minute);
    if (deltaMinutes === 0) return guess;
    guess = new Date(guess.getTime() + deltaMinutes * 60_000);
  }
  return guess;
}

export function addDaysZoned(date: Date, days: number, timeZone: string): Date {
  const parts = zonedParts(date, timeZone);
  const noon = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0));
  noon.setUTCDate(noon.getUTCDate() + days);
  const shifted = zonedParts(noon, "UTC");
  return zonedInstant(
    {
      year: shifted.year,
      month: shifted.month,
      day: shifted.day,
      hour: parts.hour,
      minute: parts.minute,
    },
    timeZone,
  );
}

export function addMonthsZoned(date: Date, months: number, timeZone: string): Date {
  const parts = zonedParts(date, timeZone);
  const utc = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1, 12, 0));
  const lastDay = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(parts.day, lastDay);
  return zonedInstant(
    {
      year: utc.getUTCFullYear(),
      month: utc.getUTCMonth() + 1,
      day,
      hour: parts.hour,
      minute: parts.minute,
    },
    timeZone,
  );
}
