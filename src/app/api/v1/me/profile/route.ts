import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { ATTENDEE_VISIBILITIES } from "@/domain/profile/types";
import { getServices } from "@/server/container";

const profileSchema = z.object({
  organizer: z
    .object({
      displayName: z.string().max(120).nullable().optional(),
      avatarUrl: z.string().url().nullable().optional(),
      bio: z.string().max(2000).nullable().optional(),
      website: z.string().url().nullable().optional(),
      linkedin: z.string().url().nullable().optional(),
    })
    .optional(),
  attendee: z
    .object({
      displayName: z.string().max(120).nullable().optional(),
      avatarUrl: z.string().url().nullable().optional(),
      bio: z.string().max(2000).nullable().optional(),
      website: z.string().url().nullable().optional(),
      linkedin: z.string().url().nullable().optional(),
      visibility: z.enum(ATTENDEE_VISIBILITIES).optional(),
    })
    .optional(),
});

export const GET = withApi(async ({ user, requestId }) => {
  const services = getServices();
  const profiles = await services.profiles.getProfiles(user!.id, user!.id);
  return jsonOk(profiles, { requestId });
});

export const PATCH = withApi(async ({ user, request, requestId }) => {
  const body = profileSchema.parse(await readJson(request));
  const services = getServices();
  if (body.organizer) {
    await services.profiles.updateOrganizer(user!.id, user!.id, body.organizer);
  }
  if (body.attendee) {
    await services.profiles.updateAttendee(user!.id, user!.id, body.attendee);
  }
  const profiles = await services.profiles.getProfiles(user!.id, user!.id);
  return jsonOk(profiles, { requestId });
});
