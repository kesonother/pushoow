export const ATTENDEE_VISIBILITIES = ["private", "organization", "public"] as const;
export type AttendeeVisibility = (typeof ATTENDEE_VISIBILITIES)[number];

export type OrganizerProfile = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  website: string | null;
  linkedin: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendeeProfile = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  website: string | null;
  linkedin: string | null;
  visibility: AttendeeVisibility;
  createdAt: Date;
  updatedAt: Date;
};

export type UserProfiles = {
  organizer: OrganizerProfile;
  attendee: AttendeeProfile;
};

export type ProfileRepository = {
  getOrganizer: (userId: string) => Promise<OrganizerProfile | null>;
  getAttendee: (userId: string) => Promise<AttendeeProfile | null>;
  upsertOrganizer: (profile: OrganizerProfile) => Promise<OrganizerProfile>;
  upsertAttendee: (profile: AttendeeProfile) => Promise<AttendeeProfile>;
};

export type SharedOrganizationLookup = {
  shareOrganization: (viewerId: string, targetId: string) => Promise<boolean>;
};
