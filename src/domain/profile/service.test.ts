import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/domain/errors";
import { createProfileService } from "@/domain/profile/service";
import type {
  AttendeeProfile,
  OrganizerProfile,
  ProfileRepository,
} from "@/domain/profile/types";

function memoryProfiles(): ProfileRepository {
  const organizers = new Map<string, OrganizerProfile>();
  const attendees = new Map<string, AttendeeProfile>();
  return {
    async getOrganizer(userId) {
      return organizers.get(userId) ?? null;
    },
    async getAttendee(userId) {
      return attendees.get(userId) ?? null;
    },
    async upsertOrganizer(profile) {
      organizers.set(profile.userId, profile);
      return profile;
    },
    async upsertAttendee(profile) {
      attendees.set(profile.userId, profile);
      return profile;
    },
  };
}

describe("profiles", () => {
  it("keeps attendee data private by default", async () => {
    const svc = createProfileService({
      profiles: memoryProfiles(),
      organizations: { shareOrganization: async () => true },
    });
    await svc.updateAttendee("user_1", "user_1", { bio: "secret attendee" });
    await svc.updateOrganizer("user_1", "user_1", { bio: "public organizer" });

    const viewed = await svc.getProfiles("user_2", "user_1");
    expect(viewed.organizer.bio).toBe("public organizer");
    expect(viewed.attendee.bio).toBeNull();
    expect(viewed.attendee.visibility).toBe("private");
  });

  it("prevents a user from editing another user's profile", async () => {
    const svc = createProfileService({
      profiles: memoryProfiles(),
      organizations: { shareOrganization: async () => false },
    });
    await expect(
      svc.updateOrganizer("user_2", "user_1", { bio: "hacked" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("reveals attendee data only when visibility allows it", async () => {
    const svc = createProfileService({
      profiles: memoryProfiles(),
      organizations: { shareOrganization: async () => true },
    });
    await svc.updateAttendee("user_1", "user_1", {
      bio: "visible to orgs",
      visibility: "organization",
    });
    const viewed = await svc.getProfiles("user_2", "user_1");
    expect(viewed.attendee.bio).toBe("visible to orgs");
  });
});
