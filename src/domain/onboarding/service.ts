import type { CalendarRepository } from "@/domain/calendar/types";
import type { CalendarFollowerRepository } from "@/domain/calendar/follow-types";
import type { EventRegistrationRepository } from "@/domain/event/commerce-types";
import { isPublishStatus, type EventRepository } from "@/domain/event/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import { recordedActivation, trackActivation } from "./activation";
import { emptyState } from "./empty-states";
import { LIFECYCLE_SERIES, type LifecycleEmailKey } from "./lifecycle";
import {
  ATTENDEE_STEPS,
  ORGANIZER_STEPS,
  type ActivationEventName,
  type AttendeeOnboarding,
  type AttendeeStep,
  type OnboardingStepState,
  type OrganizerOnboarding,
} from "./types";

export type LifecycleScheduler = (input: {
  userId: string;
  email: string;
  key: LifecycleEmailKey;
  availableAt: Date;
}) => Promise<unknown>;

export type OnboardingServiceDeps = {
  calendars: CalendarRepository;
  events: EventRepository;
  registrations: EventRegistrationRepository;
  followers: CalendarFollowerRepository;
  organizationIdsForUser?: (userId: string) => Promise<string[]>;
  scheduleLifecycle?: LifecycleScheduler;
  clock?: Clock;
};

function organizerHref(
  step: (typeof ORGANIZER_STEPS)[number],
  organizationId?: string,
  calendarId?: string,
  sharePath?: string,
): string {
  if (step === "signup") return "/register";
  if (!organizationId) return "/dashboard";
  if (step === "calendar_created") return emptyState("dashboard_calendars", { organizationId }).href;
  if (step === "event_created" || step === "event_published") {
    return calendarId
      ? emptyState("dashboard_events", { organizationId, calendarId }).href
      : `/dashboard/organizations/${organizationId}/calendars`;
  }
  if (step === "share") {
    return sharePath ?? (calendarId
      ? `/dashboard/organizations/${organizationId}/calendars/${calendarId}`
      : `/dashboard/organizations/${organizationId}/calendars`);
  }
  return calendarId
    ? `/dashboard/organizations/${organizationId}/calendars/${calendarId}`
    : `/dashboard/organizations/${organizationId}/calendars`;
}

function attendeeHref(step: AttendeeStep): string {
  if (step === "first_follow") return "/discover";
  return "/discover";
}

export function createOnboardingService(deps: OnboardingServiceDeps) {
  const clock = deps.clock ?? systemClock;

  async function derived(userId: string, organizationId?: string) {
    const orgIds = organizationId
      ? [organizationId]
      : deps.organizationIdsForUser
        ? await deps.organizationIdsForUser(userId)
        : [];
    const calendars = (
      await Promise.all(orgIds.map((id) => deps.calendars.listByOrganization(id)))
    )
      .flat()
      .filter((item) => !item.deletedAt);
    const listEvents = deps.events.listByOrganization;
    const events = listEvents
      ? (await Promise.all(orgIds.map((id) => listEvents(id)))).flat().filter((item) => !item.deletedAt)
      : [];
    const registrations = deps.registrations.listByUser ? await deps.registrations.listByUser(userId) : [];
    const follows = deps.followers.listByUser ? await deps.followers.listByUser(userId) : [];
    const published = events.filter((event) => isPublishStatus(event.status));
    const checkedIn = registrations.some((item) => item.status === "checked_in");
    return {
      calendars,
      events,
      published,
      registrations,
      follows,
      checkedIn,
      firstCalendar: calendars[0],
    };
  }

  async function track(input: {
    userId: string;
    name: ActivationEventName | AttendeeStep | "share";
    organizationId?: string;
  }) {
    return trackActivation(input);
  }

  async function organizerProgress(input: {
    userId: string;
    organizationId?: string;
  }): Promise<OrganizerOnboarding> {
    const state = await derived(input.userId, input.organizationId);
    const complete = {
      signup: true,
      calendar_created: state.calendars.length > 0,
      event_created: state.events.length > 0,
      event_published: state.published.length > 0,
      share: Boolean(recordedActivation(input.userId, "share")),
    };
    const calendarId = state.firstCalendar?.id;
    const sharePath = state.published[0]?.slug ? `/e/${state.published[0].slug}?onboarding=share` : undefined;
    const steps: OnboardingStepState[] = ORGANIZER_STEPS.map((id) => ({
      id,
      complete: complete[id],
      href: organizerHref(id, input.organizationId, calendarId, sharePath),
    }));
    return {
      role: "organizer",
      steps,
      next: steps.find((step) => !step.complete) ?? null,
      complete: steps.every((step) => step.complete),
    };
  }

  async function attendeeProgress(userId: string): Promise<AttendeeOnboarding> {
    const state = await derived(userId);
    const complete = {
      first_event: state.registrations.length > 0 || Boolean(recordedActivation(userId, "first_event")),
      first_follow: state.follows.length > 0,
      first_rsvp: state.registrations.length > 0,
    };
    const steps: OnboardingStepState[] = ATTENDEE_STEPS.map((id) => ({
      id,
      complete: complete[id],
      href: attendeeHref(id),
    }));
    return {
      role: "attendee",
      steps,
      next: steps.find((step) => !step.complete) ?? null,
      complete: steps.every((step) => step.complete),
    };
  }

  async function startForNewUser(input: { userId: string; email: string }) {
    trackActivation({ userId: input.userId, name: "signup" });
    if (!deps.scheduleLifecycle) return LIFECYCLE_SERIES.map((item) => item.key);
    const now = clock.now();
    for (const message of LIFECYCLE_SERIES) {
      await deps.scheduleLifecycle({
        userId: input.userId,
        email: input.email,
        key: message.key,
        availableAt: new Date(now.getTime() + message.delayMs),
      });
    }
    return LIFECYCLE_SERIES.map((item) => item.key);
  }

  async function shouldSend(userId: string, key: LifecycleEmailKey, organizationId?: string) {
    const message = LIFECYCLE_SERIES.find((item) => item.key === key);
    if (!message) return false;
    if (!message.skipWhen) return true;
    const state = await derived(userId, organizationId);
    if (message.skipWhen === "calendar_created") return state.calendars.length === 0;
    if (message.skipWhen === "event_created") return state.events.length === 0;
    if (message.skipWhen === "event_published") return state.published.length === 0 && state.registrations.length === 0;
    if (message.skipWhen === "first_rsvp") return state.registrations.length === 0;
    if (message.skipWhen === "first_follow") return state.follows.length === 0;
    return true;
  }

  return {
    track,
    organizerProgress,
    attendeeProgress,
    startForNewUser,
    shouldSend,
    emptyState,
  };
}
