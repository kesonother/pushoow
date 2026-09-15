import { z } from "zod";
import { AI_PERSONAS, COVER_STYLES } from "@/domain/ai/types";
import { DISCOVERY_FORMATS } from "@/domain/discovery/types";

export const descriptionBodySchema = z.object({
  title: z.string().min(1).max(200),
  tags: z.array(z.string().max(40)).max(12).optional(),
  location: z.string().max(200).nullable().optional(),
  format: z.enum(DISCOVERY_FORMATS).optional(),
  persona: z.enum(AI_PERSONAS).optional(),
  providerId: z.string().max(40).optional(),
});

export const coverBodySchema = z.object({
  title: z.string().min(1).max(200),
  tags: z.array(z.string().max(40)).max(12).optional(),
  calendarId: z.string().min(1).optional(),
  style: z.enum(COVER_STYLES).optional(),
  palette: z
    .object({
      primary: z.string().max(20),
      secondary: z.string().max(20),
    })
    .optional(),
  providerId: z.string().max(40).optional(),
});

export const suggestionsBodySchema = z.object({
  calendarId: z.string().min(1),
  title: z.string().max(200).optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
});

export const intentBodySchema = z.object({
  query: z.string().min(3).max(400),
  providerId: z.string().max(40).optional(),
});

export const aiPrivacyPatchSchema = z.object({
  processingOptOut: z.boolean().optional(),
  trainingConsent: z.boolean().optional(),
  disclosureAcknowledged: z.boolean().optional(),
});

export const aiPolicyPatchSchema = z.object({
  optedOut: z.boolean().optional(),
  trainingAllowed: z.boolean().optional(),
  providerRetentionDays: z.number().int().min(0).max(365).optional(),
});
