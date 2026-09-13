import { logNotificationAdapter } from "@/notifications/log-adapter";

export async function sendAuthEmail(input: {
  to: string;
  subject: string;
  body: string;
}) {
  await logNotificationAdapter.send({
    channel: "email",
    to: input.to,
    subject: input.subject,
    body: input.body,
  });
}
