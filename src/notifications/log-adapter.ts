import { logger } from "@/lib/logger";
import type { NotificationChannel, NotificationProvider, OutboundMessage } from "@/domain/notification/types";

export type NotificationMessage = OutboundMessage;

export type NotificationAdapter = {
  send: (message: OutboundMessage) => Promise<void>;
};

export function createLogProvider(channel: NotificationChannel): NotificationProvider {
  return {
    channel,
    isConfigured: () => true,
    async send(message) {
      logger.info(
        {
          channel: message.channel,
          hasSubject: Boolean(message.subject),
          templateKey: message.templateKey,
        },
        "Notification queued to log adapter",
      );
      return { providerMessageId: null };
    },
  };
}

export const logNotificationAdapter: NotificationAdapter = {
  async send(message) {
    await createLogProvider(message.channel).send(message);
  },
};
