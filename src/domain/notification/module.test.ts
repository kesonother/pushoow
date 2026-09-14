import { describe, expect, it } from "vitest";
import { resetRateLimits } from "@/api/rate-limit";
import {
  memoryDeliveries,
  memoryNewsletters,
  memoryPreferences,
  memorySmsConsents,
  memorySuppressions,
  recordingProvider,
} from "@/domain/notification/memory";
import { pickAbSubject } from "@/domain/notification/newsletter";
import { reminderSchedule } from "@/domain/notification/reminders";
import { createNotificationService } from "@/domain/notification/service";

function service(overrides?: {
  email?: ReturnType<typeof recordingProvider>;
  sms?: ReturnType<typeof recordingProvider>;
  whatsapp?: ReturnType<typeof recordingProvider>;
}) {
  resetRateLimits();
  const email = overrides?.email ?? recordingProvider("email");
  const sms = overrides?.sms ?? recordingProvider("sms");
  const whatsapp = overrides?.whatsapp ?? recordingProvider("whatsapp");
  return {
    email,
    sms,
    whatsapp,
    notifications: createNotificationService({
      providers: { email, sms, whatsapp },
      preferences: memoryPreferences(),
      suppressions: memorySuppressions(),
      deliveries: memoryDeliveries(),
      smsConsents: memorySmsConsents(),
      newsletters: memoryNewsletters(),
      unsubscribeSecret: "test-unsubscribe-secret-32-chars!!",
      appUrl: "http://localhost:3000",
      clock: { now: () => new Date("2026-09-13T12:00:00.000Z") },
    }),
  };
}

describe("multichannel notifications", () => {
  it("requires SMS opt-in and honors STOP opt-out", async () => {
    const { notifications, sms } = service();
    const blocked = await notifications.dispatch({
      channel: "sms",
      to: "+33612345678",
      templateKey: "reminder_24h",
      idempotencyKey: "sms-1",
    });
    expect(blocked.status).toBe("suppressed");
    expect(sms.sent).toHaveLength(0);

    await notifications.optInSms({ phone: "+33612345678", source: "web_form" });
    const sent = await notifications.dispatch({
      channel: "sms",
      to: "+33612345678",
      templateKey: "reminder_24h",
      vars: { eventTitle: "Paris AI", startsAt: "tomorrow", timezone: "Europe/Paris" },
      idempotencyKey: "sms-2",
    });
    expect(sent.status).toBe("sent");
    expect(sms.sent).toHaveLength(1);

    const stop = await notifications.handleSmsInbound("+33612345678", "STOP");
    expect(stop.optedOut).toBe(true);
    const afterStop = await notifications.dispatch({
      channel: "sms",
      to: "+33612345678",
      templateKey: "reminder_1h",
      idempotencyKey: "sms-3",
    });
    expect(afterStop.status).toBe("suppressed");
  });

  it("unsubscribes email and auto-suppresses the address", async () => {
    const { notifications, email } = service();
    const url = notifications.unsubscribeUrl("email", "Ada@Example.com");
    const token = new URL(url).searchParams.get("token");
    expect(token).toBeTruthy();
    await notifications.unsubscribe(token!);
    const delivery = await notifications.dispatch({
      channel: "email",
      to: "ada@example.com",
      templateKey: "subscriber_welcome",
      marketingConsent: true,
      vars: { calendarName: "AI Club" },
      idempotencyKey: "welcome-1",
    });
    expect(delivery.status).toBe("suppressed");
    expect(email.sent).toHaveLength(0);
  });

  it("schedules reminders from the event timezone, not the server clock", () => {
    const startsAt = new Date("2026-10-01T16:00:00.000Z");
    const slots = reminderSchedule(startsAt, "Europe/Paris");
    expect(slots).toHaveLength(2);
    expect(slots[0]?.timezone).toBe("Europe/Paris");
    expect(slots.find((item) => item.key === "reminder_24h")?.sendAt.toISOString()).toBe(
      "2026-09-30T16:00:00.000Z",
    );
    expect(slots.find((item) => item.key === "reminder_1h")?.sendAt.toISOString()).toBe(
      "2026-10-01T15:00:00.000Z",
    );
  });

  it("prevents duplicate sends with the same idempotency key", async () => {
    const { notifications, email } = service();
    const first = await notifications.dispatch({
      channel: "email",
      to: "ada@example.com",
      templateKey: "registration_confirmation",
      vars: { eventTitle: "Meetup", startsAt: "soon" },
      idempotencyKey: "reg:evt1:ada@example.com",
    });
    const second = await notifications.dispatch({
      channel: "email",
      to: "ada@example.com",
      templateKey: "registration_confirmation",
      vars: { eventTitle: "Meetup", startsAt: "soon" },
      idempotencyKey: "reg:evt1:ada@example.com",
    });
    expect(second.id).toBe(first.id);
    expect(email.sent).toHaveLength(1);
  });

  it("sends cancellation after bounce handling blocks later marketing", async () => {
    const { notifications, email } = service();
    await notifications.dispatch({
      channel: "email",
      to: "ada@example.com",
      templateKey: "cancellation",
      vars: { eventTitle: "Meetup", details: "Refund pending." },
      idempotencyKey: "cancel-1",
    });
    expect(email.sent[0]?.subject).toContain("cancelled");
    await notifications.handleBounce("ada@example.com");
    const blocked = await notifications.dispatch({
      channel: "email",
      to: "ada@example.com",
      templateKey: "cancellation",
      vars: { eventTitle: "Meetup", details: "" },
      idempotencyKey: "cancel-2",
    });
    expect(blocked.status).toBe("suppressed");
  });

  it("retries are the queue's job; provider failure is surfaced", async () => {
    const email = recordingProvider("email", { fail: true });
    const { notifications } = service({ email });
    await expect(
      notifications.dispatch({
        channel: "email",
        to: "ada@example.com",
        templateKey: "receipt",
        vars: { eventTitle: "Meetup", amount: "12 EUR" },
        idempotencyKey: "receipt-1",
      }),
    ).rejects.toThrow(/provider failed/i);
    expect(email.sent).toHaveLength(0);
  });

  it("respects marketing preferences and List-Unsubscribe headers", async () => {
    const { notifications, email } = service();
    await notifications.setPreference({
      userId: "user_1",
      channel: "email",
      category: "marketing",
      enabled: false,
    });
    const blocked = await notifications.dispatch({
      userId: "user_1",
      channel: "email",
      to: "ada@example.com",
      templateKey: "subscriber_welcome",
      marketingConsent: true,
      vars: { calendarName: "AI Club" },
      idempotencyKey: "pref-1",
    });
    expect(blocked.status).toBe("suppressed");

    await notifications.setPreference({
      userId: "user_1",
      channel: "email",
      category: "marketing",
      enabled: true,
    });
    const sent = await notifications.dispatch({
      userId: "user_1",
      channel: "email",
      to: "ada@example.com",
      templateKey: "subscriber_welcome",
      marketingConsent: true,
      vars: { calendarName: "AI Club" },
      idempotencyKey: "pref-2",
    });
    expect(sent.status).toBe("sent");
    expect(sent.body).toContain("AI Club");
    expect(email.sent[0]?.headers?.["List-Unsubscribe"]).toMatch(/unsubscribe\?token=/);
    expect(email.sent[0]?.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("only sends approved WhatsApp templates and splits newsletter subjects", async () => {
    const { notifications, whatsapp } = service();
    await expect(
      notifications.dispatch({
        channel: "whatsapp",
        to: "+33612345678",
        templateKey: "freeform",
        bodyOverride: "Hi",
        idempotencyKey: "wa-bad",
      }),
    ).rejects.toThrow(/approved template/i);

    await notifications.setPreference({
      userId: "user_1",
      channel: "whatsapp",
      category: "transactional",
      enabled: true,
    });
    const confirmation = await notifications.dispatch({
      userId: "user_1",
      channel: "whatsapp",
      to: "+33612345678",
      templateKey: "confirmation",
      idempotencyKey: "wa-ok",
    });
    expect(confirmation.status).toBe("sent");
    expect(whatsapp.sent[0]?.body).toBe("event_confirmation");

    const pickedA = pickAbSubject({ subjectA: "Hello A", subjectB: "Hello B" }, "even");
    const pickedB = pickAbSubject({ subjectA: "Hello A", subjectB: "Hello B" }, "odd-user-key");
    expect(["a", "b"]).toContain(pickedA.variant);
    expect(["a", "b"]).toContain(pickedB.variant);
  });
});
