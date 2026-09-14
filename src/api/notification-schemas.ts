import { z } from "zod";
import { NEWSLETTER_BLOCK_TYPES } from "@/domain/notification/newsletter";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS } from "@/domain/notification/types";

export const notificationPreferenceSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  category: z.enum(NOTIFICATION_CATEGORIES),
  enabled: z.boolean(),
  trackingConsent: z.boolean().optional(),
});

export const newsletterWriteSchema = z.object({
  subjectA: z.string().min(1).max(180),
  subjectB: z.string().max(180).nullable().optional(),
  blocks: z
    .array(
      z.object({
        type: z.enum(NEWSLETTER_BLOCK_TYPES),
        text: z.string().optional(),
        eventId: z.string().optional(),
        title: z.string().optional(),
        src: z.string().url().optional(),
        alt: z.string().optional(),
        label: z.string().optional(),
        href: z.string().url().optional(),
      }),
    )
    .max(40),
});
