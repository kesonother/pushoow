import { z } from "zod";
import { CALENDAR_VISIBILITIES } from "@/domain/calendar/types";
import { TIER_KINDS } from "@/domain/calendar/membership-types";

export const calendarWriteSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(80).optional(),
  description: z.string().max(2000).nullable().optional(),
  timezone: z.string().min(1).max(80).optional(),
  locale: z.string().min(2).max(10).optional(),
  defaultCurrency: z.string().min(3).max(8).optional(),
  visibility: z.enum(CALENDAR_VISIBILITIES).optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().max(7).nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  socialLink: z.string().url().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  postalAddress: z.string().max(240).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  bannedWords: z.array(z.string().min(1).max(40)).max(200).optional(),
});

export const createCalendarSchema = calendarWriteSchema.extend({
  name: z.string().min(2).max(120),
});

export const followPreferencesSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  sms: z.boolean().optional(),
});

export const subscribeSchema = z.object({
  email: z.string().email(),
});

export const tierWriteSchema = z.object({
  name: z.string().min(2).max(80),
  kind: z.enum(TIER_KINDS),
  visibility: z.enum(["public", "members"]).optional(),
  memberOnlyTickets: z.boolean().optional(),
  newsletters: z.boolean().optional(),
  earlyRsvp: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  priceCents: z.number().int().positive().nullable().optional(),
  currency: z.string().min(3).max(8).nullable().optional(),
  interval: z.enum(["month", "year"]).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const joinSchema = z.object({
  tierId: z.string().min(1),
});

export const decideSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});
