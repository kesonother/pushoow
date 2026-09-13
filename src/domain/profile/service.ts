import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type {
  AttendeeProfile,
  AttendeeVisibility,
  OrganizerProfile,
  ProfileRepository,
  SharedOrganizationLookup,
  UserProfiles,
} from "@/domain/profile/types";

export type ProfileServiceDeps = {
  profiles: ProfileRepository;
  organizations: SharedOrganizationLookup;
  clock?: Clock;
};

function emptyOrganizer(userId: string, now: Date): OrganizerProfile {
  return {
    userId,
    displayName: null,
    avatarUrl: null,
    bio: null,
    website: null,
    linkedin: null,
    createdAt: now,
    updatedAt: now,
  };
}

function emptyAttendee(userId: string, now: Date): AttendeeProfile {
  return {
    userId,
    displayName: null,
    avatarUrl: null,
    bio: null,
    website: null,
    linkedin: null,
    visibility: "private",
    createdAt: now,
    updatedAt: now,
  };
}

function publicOrganizer(profile: OrganizerProfile): OrganizerProfile {
  return profile;
}

function redactAttendee(profile: AttendeeProfile): AttendeeProfile {
  return {
    ...profile,
    displayName: null,
    avatarUrl: null,
    bio: null,
    website: null,
    linkedin: null,
    visibility: profile.visibility,
  };
}

export function createProfileService(deps: ProfileServiceDeps) {
  const clock = deps.clock ?? systemClock;

  async function ensureProfiles(userId: string): Promise<UserProfiles> {
    const now = clock.now();
    const organizer =
      (await deps.profiles.getOrganizer(userId)) ??
      (await deps.profiles.upsertOrganizer(emptyOrganizer(userId, now)));
    const attendee =
      (await deps.profiles.getAttendee(userId)) ??
      (await deps.profiles.upsertAttendee(emptyAttendee(userId, now)));
    return { organizer, attendee };
  }

  async function getProfiles(viewerId: string, targetId: string): Promise<UserProfiles> {
    const profiles = await ensureProfiles(targetId);
    if (viewerId === targetId) return profiles;

    const attendeeVisible =
      profiles.attendee.visibility === "public" ||
      (profiles.attendee.visibility === "organization" &&
        (await deps.organizations.shareOrganization(viewerId, targetId)));

    return {
      organizer: publicOrganizer(profiles.organizer),
      attendee: attendeeVisible ? profiles.attendee : redactAttendee(profiles.attendee),
    };
  }

  async function updateOrganizer(
    actorUserId: string,
    targetId: string,
    input: Partial<Pick<OrganizerProfile, "displayName" | "avatarUrl" | "bio" | "website" | "linkedin">>,
  ) {
    if (actorUserId !== targetId) {
      throw new ForbiddenError("You can only update your own organizer profile");
    }
    const current = (await ensureProfiles(targetId)).organizer;
    return deps.profiles.upsertOrganizer({
      ...current,
      ...sanitizeProfile(input),
      updatedAt: clock.now(),
    });
  }

  async function updateAttendee(
    actorUserId: string,
    targetId: string,
    input: Partial<
      Pick<AttendeeProfile, "displayName" | "avatarUrl" | "bio" | "website" | "linkedin" | "visibility">
    >,
  ) {
    if (actorUserId !== targetId) {
      throw new ForbiddenError("You can only update your own attendee profile");
    }
    if (input.visibility && !["private", "organization", "public"].includes(input.visibility)) {
      throw new ValidationError("Invalid attendee visibility");
    }
    const current = (await ensureProfiles(targetId)).attendee;
    return deps.profiles.upsertAttendee({
      ...current,
      ...sanitizeProfile(input),
      visibility: input.visibility ?? current.visibility,
      updatedAt: clock.now(),
    });
  }

  async function requireOwn(viewerId: string, targetId: string) {
    if (viewerId !== targetId) {
      throw new NotFoundError("Profile", targetId);
    }
  }

  return {
    ensureProfiles,
    getProfiles,
    updateOrganizer,
    updateAttendee,
    requireOwn,
  };
}

function sanitizeProfile<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input };
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      (next as Record<string, unknown>)[key] = trimmed.length === 0 ? null : trimmed;
    }
  }
  return next;
}

export type { AttendeeVisibility };
