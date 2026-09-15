export type EmptyStateId =
  | "dashboard_organizations"
  | "dashboard_calendars"
  | "dashboard_events"
  | "dashboard_checkin"
  | "me_events"
  | "me_calendars"
  | "me_tickets"
  | "discover_events"
  | "calendar_join";

export type EmptyStateSpec = {
  id: EmptyStateId;
  action: "create_organization" | "create_calendar" | "create_event" | "follow_calendars" | "discover_events";
  href: (input?: { organizationId?: string; calendarId?: string }) => string;
};

export const EMPTY_STATES: EmptyStateSpec[] = [
  {
    id: "dashboard_organizations",
    action: "create_organization",
    href: () => "/dashboard",
  },
  {
    id: "dashboard_calendars",
    action: "create_calendar",
    href: (input) => `/dashboard/organizations/${input?.organizationId ?? ""}/calendars?template=meetup`,
  },
  {
    id: "dashboard_events",
    action: "create_event",
    href: (input) =>
      `/dashboard/organizations/${input?.organizationId ?? ""}/calendars/${input?.calendarId ?? ""}/events/new?starter=first_meetup`,
  },
  {
    id: "dashboard_checkin",
    action: "create_event",
    href: (input) =>
      input?.organizationId
        ? `/dashboard/organizations/${input.organizationId}/calendars`
        : "/dashboard",
  },
  {
    id: "me_events",
    action: "discover_events",
    href: () => "/discover",
  },
  {
    id: "me_calendars",
    action: "follow_calendars",
    href: () => "/discover",
  },
  {
    id: "me_tickets",
    action: "discover_events",
    href: () => "/discover",
  },
  {
    id: "discover_events",
    action: "discover_events",
    href: () => "/calendars",
  },
  {
    id: "calendar_join",
    action: "follow_calendars",
    href: () => "/login?next=/discover",
  },
];

export function emptyState(id: EmptyStateId, input?: { organizationId?: string; calendarId?: string }) {
  const spec = EMPTY_STATES.find((item) => item.id === id);
  if (!spec) throw new Error(`Unknown empty state ${id}`);
  return { ...spec, href: spec.href(input) };
}
