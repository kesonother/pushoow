import { normalizeHeader } from "@/domain/import/csv";
import type { ImportField, ImportKind, ImportMapping } from "@/domain/import/types";

const ALIASES: Record<ImportField, string[]> = {
  email: ["email", "emailaddress", "guestemail", "attendeeemail", "e-mail"],
  name: ["name", "fullname", "guestname", "attendeename", "displayname"],
  ticketType: ["tickettype", "ticket", "ticketname", "tier"],
  status: ["status", "approvalstatus", "rsvp", "rsvpstatus"],
  createdAt: ["createdat", "registeredat", "created", "joinedat", "subscribedat"],
  title: ["title", "name", "eventname", "event", "eventtitle", "calendarname"],
  startsAt: ["startsat", "start", "starttime", "startdate", "beginsat"],
  endsAt: ["endsat", "end", "endtime", "enddate"],
  timezone: ["timezone", "tz", "time zone"],
  description: ["description", "about", "body"],
  venue: ["venue", "location", "venuename", "place"],
  city: ["city"],
  tags: ["tags", "topics", "keywords"],
  website: ["website", "url", "social", "sociallink"],
};

const KIND_FIELDS: Record<ImportKind, ImportField[]> = {
  guests: ["email", "name", "ticketType", "status", "createdAt"],
  subscribers: ["email", "name", "createdAt"],
  events: ["title", "startsAt", "endsAt", "timezone", "description", "venue", "city", "tags"],
  calendar: ["title", "description", "timezone", "tags", "city", "website"],
};

export function fieldsForKind(kind: ImportKind): ImportField[] {
  return KIND_FIELDS[kind];
}

export function requiredFields(kind: ImportKind): ImportField[] {
  if (kind === "guests" || kind === "subscribers") return ["email"];
  if (kind === "events") return ["title", "startsAt"];
  return ["title"];
}

export function suggestMapping(kind: ImportKind, headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<string>();
  for (const field of KIND_FIELDS[kind]) {
    const aliases = ALIASES[field];
    const match = headers.find((header) => {
      const key = normalizeHeader(header);
      return (
        !used.has(header) &&
        aliases.some((alias) => {
          const normalized = normalizeHeader(alias);
          return key === normalized || (normalized.length > 3 && key.includes(normalized));
        })
      );
    });
    if (match) {
      mapping[field] = match;
      used.add(match);
    }
  }
  return mapping;
}
