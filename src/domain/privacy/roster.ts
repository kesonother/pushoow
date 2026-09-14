import { ForbiddenError } from "@/domain/errors";
import type { EventRegistration } from "@/domain/event/commerce-types";
import type { Event } from "@/domain/event/types";
import type { AttendeeProfile } from "@/domain/profile/types";
import { assertSameTenant } from "@/domain/tenant/isolation";
import {
  DEFAULT_ROSTER_MODE,
  SENSITIVE_ROSTER_FIELDS,
  type RosterEntry,
  type RosterMode,
  type RosterView,
  type RosterViewer,
} from "@/domain/privacy/types";

export function normalizeRosterMode(value: string | null | undefined): RosterMode {
  if (value === "visible" || value === "hidden" || value === "anonymized" || value === "approval_only") {
    return value;
  }
  return DEFAULT_ROSTER_MODE;
}

function staffCanRead(event: Event, viewer: RosterViewer): boolean {
  return Boolean(
    viewer.canReadRegistrants && viewer.organizationId && viewer.organizationId === event.organizationId,
  );
}

function publicRosterAllowed(mode: RosterMode, viewer: RosterViewer): boolean {
  if (mode === "hidden") return false;
  if (mode === "approval_only") return Boolean(viewer.approvedAttendee || viewer.canReadRegistrants);
  return true;
}

function stripSensitive<T extends Record<string, unknown>>(value: T): T {
  const next = { ...value };
  for (const key of SENSITIVE_ROSTER_FIELDS) {
    if (key in next) delete next[key];
  }
  return next;
}

export function projectRosterEntry(
  registration: EventRegistration,
  profile: AttendeeProfile | null,
  mode: RosterMode,
  index: number,
): RosterEntry | null {
  if (registration.status === "cancelled" || registration.status === "expired") return null;
  if (registration.anonymous) {
    if (mode === "hidden") return null;
    return {
      id: registration.id,
      displayName: mode === "anonymized" || mode === "visible" || mode === "approval_only" ? `Attendee ${index + 1}` : null,
      avatarUrl: null,
      bio: null,
      website: null,
      linkedin: null,
      anonymous: true,
    };
  }
  if (!registration.appearOnRoster) return null;
  if (mode === "anonymized") {
    return {
      id: registration.id,
      displayName: `Attendee ${index + 1}`,
      avatarUrl: null,
      bio: null,
      website: null,
      linkedin: null,
      anonymous: false,
    };
  }
  const publicProfile = profile?.visibility === "public";
  return stripSensitive({
    id: registration.id,
    displayName: publicProfile ? (profile?.displayName ?? null) : null,
    avatarUrl: publicProfile && profile?.showAvatar ? (profile.avatarUrl ?? null) : null,
    bio: publicProfile && profile?.showBio ? (profile.bio ?? null) : null,
    website: publicProfile && profile?.showSocial ? (profile.website ?? null) : null,
    linkedin: publicProfile && profile?.showSocial ? (profile.linkedin ?? null) : null,
    anonymous: false,
  });
}

export function buildRoster(input: {
  event: Event;
  registrations: EventRegistration[];
  profiles: Map<string, AttendeeProfile>;
  viewer: RosterViewer;
}): RosterView {
  const mode = normalizeRosterMode(input.event.rosterMode);
  const staff = staffCanRead(input.event, input.viewer);
  if (staff) {
    assertSameTenant(input.event, input.viewer.organizationId!, "Event");
  }
  const visible = staff || publicRosterAllowed(mode, input.viewer);
  if (!visible) {
    return { mode, visible: false, entries: [], count: 0 };
  }

  const active = input.registrations.filter(
    (item) => item.status !== "cancelled" && item.status !== "expired",
  );
  const entries: RosterEntry[] = [];
  active.forEach((registration, index) => {
    const profile = registration.userId ? (input.profiles.get(registration.userId) ?? null) : null;
    const entry = projectRosterEntry(registration, profile, mode, index);
    if (entry) entries.push(entry);
  });

  for (const entry of entries) {
    const record = entry as unknown as Record<string, unknown>;
    for (const key of SENSITIVE_ROSTER_FIELDS) {
      if (record[key] != null) {
        throw new ForbiddenError("Roster must never expose sensitive personal data");
      }
    }
  }

  return { mode, visible: true, entries, count: entries.length };
}

export function assertCanMutateRosterMode(canUpdateEvents: boolean) {
  if (!canUpdateEvents) {
    throw new ForbiddenError("You cannot change the event roster mode");
  }
}
