import { z } from "zod";
import { WIZARD_STEPS } from "@/domain/event/wizard";
import {
  EVENT_STATUSES,
  EVENT_VISIBILITIES,
  LOCATION_KINDS,
  REGISTRATION_MODES,
  ROSTER_MODES,
} from "@/domain/event/types";
import { RECURRENCE_FREQUENCIES } from "@/domain/event/recurrence";

export const eventWriteSchema = z.object({
  title: z.string().min(2).max(180).optional(),
  slug: z.string().min(2).max(80).optional(),
  description: z.string().max(20000).nullable().optional(),
  startsAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().optional(),
  timezone: z.string().min(1).max(80).optional(),
  status: z.enum(EVENT_STATUSES).optional(),
  visibility: z.enum(EVENT_VISIBILITIES).optional(),
  isPaid: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  city: z.string().max(80).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  category: z.string().max(40).nullable().optional(),
  language: z.string().min(2).max(10).nullable().optional(),
  venueName: z.string().max(160).nullable().optional(),
  venueAddress: z.string().max(240).nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  locationKind: z.enum(LOCATION_KINDS).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  customPinLabel: z.string().max(80).nullable().optional(),
  virtualUrl: z.string().url().nullable().optional(),
  virtualProvider: z.string().max(80).nullable().optional(),
  templateId: z.string().max(40).nullable().optional(),
  registrationMode: z.enum(REGISTRATION_MODES).optional(),
  rosterMode: z.enum(ROSTER_MODES).optional(),
  registrationPassword: z.string().min(4).max(80).nullable().optional(),
  allowedEmailDomains: z.array(z.string().min(3).max(80)).optional(),
  accessToken: z.string().min(6).max(120).nullable().optional(),
  waitlistEnabled: z.boolean().optional(),
  waitlistDuringPresale: z.boolean().optional(),
});

export const createEventSchema = eventWriteSchema.extend({
  title: z.string().min(2).max(180),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});

export const wizardSchema = eventWriteSchema.extend({
  step: z.enum(WIZARD_STEPS),
  eventId: z.string().optional(),
});

export const postponeSchema = z.object({
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});

export const recurrenceSchema = z.object({
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.number().int().positive().optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  until: z.iso.datetime().nullable().optional(),
  count: z.number().int().positive().nullable().optional(),
  exceptions: z.array(z.iso.datetime()).optional(),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  token: z.string().optional(),
  invitation: z.boolean().optional(),
  ticketTypeId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  anonymous: z.boolean().optional(),
  appearOnRoster: z.boolean().optional(),
  captchaId: z.string().optional(),
  captchaAnswer: z.string().optional(),
});

export const orderSchema = z.object({
  email: z.string().email(),
  items: z.array(z.object({ ticketTypeId: z.string(), quantity: z.number().int().positive() })),
  addOnIds: z.array(z.string()).optional(),
  couponCode: z.string().optional(),
  taxExemptionCode: z.string().optional(),
  billingCountry: z.string().min(2).max(2).optional(),
  billingPostalCode: z.string().max(16).optional(),
  password: z.string().optional(),
  token: z.string().optional(),
  anonymous: z.boolean().optional(),
  appearOnRoster: z.boolean().optional(),
  captchaId: z.string().optional(),
  captchaAnswer: z.string().optional(),
});

export const quoteSchema = z.object({
  items: z.array(z.object({ ticketTypeId: z.string(), quantity: z.number().int().positive() })),
  addOnIds: z.array(z.string()).optional(),
  couponCode: z.string().optional(),
  taxExemptionCode: z.string().optional(),
  billingCountry: z.string().min(2).max(2).optional(),
  billingPostalCode: z.string().max(16).optional(),
});
