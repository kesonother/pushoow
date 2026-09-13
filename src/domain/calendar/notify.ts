import type { CalendarFollowerRepository } from "@/domain/calendar/follow-types";
import type { UserDirectory } from "@/domain/organization/types";
import type { JobType } from "@/jobs/types";

export type EventChange = "published" | "updated" | "cancelled";

export type EnqueueJob = (input: {
  type: JobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}) => Promise<unknown>;

export function createCalendarNotifyService(deps: {
  followers: CalendarFollowerRepository;
  users: UserDirectory;
  enqueue: EnqueueJob;
}) {
  async function notifyEventChange(input: {
    calendarId: string;
    eventId: string;
    change: EventChange;
    title: string;
    calendarName: string;
  }): Promise<number> {
    const followers = await deps.followers.listByCalendar(input.calendarId);
    let queued = 0;

    for (const follower of followers) {
      const user = await deps.users.findById(follower.userId);
      if (follower.preferences.email && user?.email) {
        await deps.enqueue({
          type: "email.send",
          payload: {
            to: user.email,
            subject: `${input.calendarName}: ${input.title} ${input.change}`,
            body: `The event "${input.title}" was ${input.change} on ${input.calendarName}.`,
          },
          idempotencyKey: `cal-follow-email:${input.eventId}:${input.change}:${follower.id}`,
        });
        queued += 1;
      }
      if (follower.preferences.sms) {
        // Phone numbers are not stored on the user yet; do not invent a destination.
      }
      if (follower.preferences.push) {
        // No push adapter is configured; preference is stored for a future provider.
      }
    }

    return queued;
  }

  return { notifyEventChange };
}

export type EventChangeNotifier = {
  notify: (input: {
    organizationId: string;
    calendarId: string;
    eventId: string;
    change: EventChange;
    title: string;
    calendarName: string;
  }) => Promise<void>;
};
