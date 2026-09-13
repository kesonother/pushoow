import { z } from "zod";

export const chatMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  threadId: z.string().optional(),
  parentId: z.string().nullable().optional(),
  clientId: z.string().min(6).max(80).optional(),
  asOrganizer: z.boolean().optional(),
});

export const chatThreadSchema = z.object({
  title: z.string().min(2).max(120),
});

export const chatReportSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const chatModerateSchema = z.object({
  action: z.enum(["soft_delete", "hard_delete"]),
  reason: z.string().min(3).max(500).optional(),
});

export const chatBanSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["ban", "unban"]),
  reason: z.string().min(3).max(500),
});
