import { getDb } from "@/db/client";
import { createJobQueue } from "@/jobs/queue";
import { createDrizzleJobRepository } from "@/jobs/job-repo";
import { logNotificationAdapter } from "@/notifications/log-adapter";
import { logger } from "@/lib/logger";
import { getServices } from "@/server/container";

async function main() {
  const db = getDb();
  const queue = createJobQueue({ jobs: createDrizzleJobRepository(db) });

  logger.info("Job worker started");

  const tick = async () => {
    const processed = await queue.processNext({
      "email.send": async (job) => {
        await logNotificationAdapter.send({
          channel: "email",
          to: String(job.payload.to ?? ""),
          subject: String(job.payload.subject ?? ""),
          body: String(job.payload.body ?? ""),
        });
      },
      "sms.send": async (job) => {
        await logNotificationAdapter.send({
          channel: "sms",
          to: String(job.payload.to ?? ""),
          body: String(job.payload.body ?? ""),
        });
      },
      "whatsapp.send": async (job) => {
        await logNotificationAdapter.send({
          channel: "whatsapp",
          to: String(job.payload.to ?? ""),
          body: String(job.payload.body ?? ""),
        });
      },
      "calendar.followers.notify": async (job) => {
        const services = getServices();
        await services.followerNotify.notifyEventChange({
          calendarId: String(job.payload.calendarId ?? ""),
          eventId: String(job.payload.eventId ?? ""),
          change: (job.payload.change as "published" | "updated" | "cancelled") ?? "updated",
          title: String(job.payload.title ?? "Event"),
          calendarName: String(job.payload.calendarName ?? "Calendar"),
        });
      },
      "waitlist.expire": async (job) => {
        await getServices().registrations.expireDueOffers(String(job.payload.eventId ?? ""));
      },
      "chat.archive": async (job) => {
        const eventId = String(job.payload.eventId ?? "");
        if (eventId) await getServices().chat.archiveIfDue(eventId);
      },
    });

    if (processed) {
      logger.info({ jobId: processed.id, type: processed.type, status: processed.status }, "Job processed");
    }
  };

  for (;;) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

main().catch((error) => {
  logger.error({ err: error }, "Job worker crashed");
  process.exit(1);
});
