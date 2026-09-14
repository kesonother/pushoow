import { z } from "zod";
import { createEventSchema, eventWriteSchema, registerSchema } from "@/api/event-schemas";
import { PUBLIC_WEBHOOK_EVENTS } from "@/domain/public-api/types";

export const publicEventCreateSchema = createEventSchema.extend({
  calendarId: z.string().min(1),
});

export const publicEventUpdateSchema = eventWriteSchema;

export const publicRegistrationSchema = registerSchema;

export const publicCheckInSchema = z.object({
  token: z.string().optional(),
  registrationId: z.string().optional(),
  ticketCode: z.string().optional(),
  email: z.string().email().optional(),
  clientOpId: z.string().min(4).max(120).optional(),
  deviceId: z.string().max(80).optional(),
  source: z.enum(["scan", "search", "bulk", "walk_in", "sync"]).optional(),
});

export const publicRefundSchema = z.object({
  orderId: z.string().min(1),
  amountCents: z.number().int().positive().optional(),
  issuedTicketId: z.string().optional(),
  reason: z.string().min(2).max(240),
});

export const publicWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(PUBLIC_WEBHOOK_EVENTS)).min(1),
});

export const publicOAuthTokenSchema = z.object({
  grant_type: z.string(),
  code: z.string().optional(),
  redirect_uri: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().optional(),
  code_verifier: z.string().optional(),
});
