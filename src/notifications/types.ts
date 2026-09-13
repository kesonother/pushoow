export type NotificationChannel = "email" | "sms" | "whatsapp";

export type NotificationMessage = {
  channel: NotificationChannel;
  to: string;
  subject?: string;
  body: string;
  idempotencyKey?: string;
};

export type NotificationAdapter = {
  send: (message: NotificationMessage) => Promise<void>;
};
