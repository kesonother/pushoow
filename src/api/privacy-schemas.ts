import { z } from "zod";
import { CONSENT_PURPOSES } from "@/domain/privacy/types";
import { ROSTER_MODES } from "@/domain/event/types";

export const captchaAnswerSchema = z.object({
  id: z.string().min(1),
  answer: z.string().min(1).max(20),
});

export const consentSchema = z.object({
  purpose: z.enum(CONSENT_PURPOSES),
  granted: z.boolean(),
  source: z.string().min(2).max(80).optional(),
});

export const privacyActionSchema = z.object({
  action: z.enum(["acknowledge", "opt_out", "consent", "export", "portability", "delete"]),
  purpose: z.enum(CONSENT_PURPOSES).optional(),
  granted: z.boolean().optional(),
});

export const rosterModeSchema = z.enum(ROSTER_MODES);
