import { getDb } from "@/db/client";
import { createJobQueue } from "@/jobs/queue";
import { createDrizzleJobRepository } from "@/jobs/job-repo";
import type { DispatchInput } from "@/domain/notification/service";
import type { LifecycleEmailKey } from "@/domain/onboarding/lifecycle";
import { requestLogger } from "@/lib/logger";
import { getServices } from "@/server/container";

function dispatchFromJob(payload: Record<string, unknown>, fallbackKey: string): DispatchInput {
  if (typeof payload.templateKey === "string" && typeof payload.to === "string") {
    return payload as DispatchInput;
  }
  return {
    channel: (payload.channel as DispatchInput["channel"]) ?? "email",
    to: String(payload.to ?? ""),
    templateKey: String(payload.templateKey ?? "event_update"),
    subjectOverride: payload.subject ? String(payload.subject) : undefined,
    bodyOverride: payload.body ? String(payload.body) : undefined,
    idempotencyKey: String(payload.idempotencyKey ?? fallbackKey),
  };
}

async function main() {
  const db = getDb();
  const queue = createJobQueue({ jobs: createDrizzleJobRepository(db) });
  const log = requestLogger({ service: "worker" });

  log.info("Job worker started");

  const tick = async () => {
    const services = getServices();
    const processed = await queue.processNext({
      "email.send": async (job) => {
        await services.notifications.dispatch(dispatchFromJob(job.payload, job.idempotencyKey ?? job.id));
      },
      "sms.send": async (job) => {
        await services.notifications.dispatch(dispatchFromJob({ ...job.payload, channel: "sms" }, job.idempotencyKey ?? job.id));
      },
      "whatsapp.send": async (job) => {
        await services.notifications.dispatch(
          dispatchFromJob({ ...job.payload, channel: "whatsapp" }, job.idempotencyKey ?? job.id),
        );
      },
      "web_push.send": async (job) => {
        await services.notifications.dispatch(
          dispatchFromJob({ ...job.payload, channel: "web_push" }, job.idempotencyKey ?? job.id),
        );
      },
      "mobile_push.send": async (job) => {
        await services.notifications.dispatch(
          dispatchFromJob({ ...job.payload, channel: "mobile_push" }, job.idempotencyKey ?? job.id),
        );
      },
      "calendar.followers.notify": async (job) => {
        await services.followerNotify.notifyEventChange({
          calendarId: String(job.payload.calendarId ?? ""),
          eventId: String(job.payload.eventId ?? ""),
          change: (job.payload.change as "published" | "updated" | "cancelled") ?? "updated",
          title: String(job.payload.title ?? "Event"),
          calendarName: String(job.payload.calendarName ?? "Calendar"),
        });
      },
      "reminder.schedule": async (job) => {
        const eventId = String(job.payload.eventId ?? "");
        const event = await services.eventRepo.findById(eventId);
        if (!event || event.status === "cancelled" || event.deletedAt) return;
        const people = await services.eventRegistrations.listByEvent(event.id);
        await services.notifications.scheduleEventReminders({
          eventId: event.id,
          eventTitle: event.title,
          startsAt: event.startsAt,
          timezone: event.timezone,
          recipients: people.map((item) => ({ userId: item.userId, email: item.email })),
        });
      },
      "waitlist.expire": async (job) => {
        await services.registrations.expireDueOffers(String(job.payload.eventId ?? ""));
      },
      "chat.archive": async (job) => {
        const eventId = String(job.payload.eventId ?? "");
        if (eventId) await services.chat.archiveIfDue(eventId);
      },
      "privacy.deletion.process": async () => {
        await services.privacy.processDueDeletions();
      },
      "import.purge": async () => {
        await services.imports.purgeExpired();
      },
      "audit.purge": async () => {
        await services.audit.purgeExpired();
      },
      "billing.renewal.process": async () => {
        await services.billing.processRenewals();
      },
      "billing.renewal.notify": async () => {
        await services.billing.processRenewalNotices();
      },
      "billing.grace.expire": async () => {
        await services.billing.processGraceExpiry();
      },
      "support.sla.tick": async () => {
        await services.support.processSlaTick();
      },
      "onboarding.lifecycle": async (job) => {
        const userId = String(job.payload.userId ?? "");
        const email = String(job.payload.email ?? "");
        const templateKey = String(job.payload.templateKey ?? "");
        if (!userId || !email || !templateKey) return;
        const allowed = await services.onboarding.shouldSend(userId, templateKey as LifecycleEmailKey);
        if (!allowed) return;
        await services.notifications.dispatch({
          userId,
          channel: "email",
          to: email,
          templateKey,
          idempotencyKey: `onboarding:${userId}:${templateKey}`,
        });
      },
      "sync.run": async (job) => {
        await services.integrations.processSyncJob(job.payload);
      },
      "webhook.deliver": async (job) => {
        if (job.payload.kind === "public") {
          const deliveryId = String(job.payload.deliveryId ?? "");
          if (deliveryId) await services.publicApi.attemptDelivery(deliveryId);
          return;
        }
        const organizationId = String(job.payload.organizationId ?? "");
        const provider = String(job.payload.provider ?? "");
        if (!organizationId || !provider) return;
        await services.integrations.handleWebhook(
          organizationId,
          provider,
          (job.payload.headers as Record<string, string>) ?? {},
          String(job.payload.rawBody ?? ""),
        );
      },
      "ai.process": async (job) => {
        await services.ai.processJob(job.payload);
      },
      "report.generate": async (job) => {
        const eventId = typeof job.payload.eventId === "string" ? job.payload.eventId : "";
        const organizationId = typeof job.payload.organizationId === "string" ? job.payload.organizationId : "";
        if (eventId) {
          const event = await services.eventRepo.findById(eventId);
          if (!event) return;
          await services.analytics.refreshEvent(eventId, {
            userId: "system",
            organizationId: event.organizationId,
            role: "owner",
          });
          return;
        }
        if (organizationId) {
          await services.analytics.refreshOrganization(organizationId, {
            userId: "system",
            organizationId,
            role: "owner",
          });
        }
      },
      "export.generate": async () => {
        return;
      },
    });

    if (processed) {
      log.info(
        { jobId: processed.id, type: processed.type, status: processed.status, service: "worker" },
        "Job processed",
      );
    }
  };

  for (;;) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

main().catch((error) => {
  requestLogger({ service: "worker" }).error({ err: error, service: "worker" }, "Job worker crashed");
  process.exit(1);
});
