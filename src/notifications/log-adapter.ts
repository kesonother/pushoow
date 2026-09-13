import { logger } from "@/lib/logger";
import type { NotificationAdapter } from "@/notifications/types";

export const logNotificationAdapter: NotificationAdapter = {
  async send(message) {
    logger.info(
      {
        channel: message.channel,
        hasSubject: Boolean(message.subject),
      },
      "Notification queued to log adapter",
    );
  },
};
