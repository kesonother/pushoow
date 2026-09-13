import { describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/domain/errors";
import { createCalendarService } from "@/domain/calendar/service";
import { createMembershipService } from "@/domain/calendar/membership-service";
import { PaymentNotConfiguredError } from "@/domain/calendar/membership-types";
import type { Actor } from "@/domain/rbac/permissions";
import {
  createMemoryCalendarMembers,
  createMemoryCalendars,
  createMemoryTiers,
} from "@/test/fakes";

const owner: Actor = {
  userId: "user_1",
  organizationId: "org_1",
  role: "owner",
};

async function setup() {
  const calendars = createMemoryCalendars();
  const notifications: string[] = [];
  const memberships = createMembershipService({
    calendars,
    tiers: createMemoryTiers(),
    members: createMemoryCalendarMembers(),
    notify: {
      async notify(input) {
        notifications.push(input.kind);
      },
    },
  });
  const calendar = await createCalendarService({ calendars }).createCalendar(owner, {
    name: "Club",
    visibility: "private",
  });
  return { memberships, calendar, notifications };
}

describe("calendar memberships", () => {
  it("caps tiers at five and isolates RBAC", async () => {
    const { memberships, calendar } = await setup();
    for (let index = 0; index < 5; index += 1) {
      await memberships.createTier(owner, calendar.id, { name: `Tier ${index}`, kind: "free" });
    }
    await expect(
      memberships.createTier(owner, calendar.id, { name: "Too many", kind: "free" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      memberships.createTier({ ...owner, role: "finance" }, calendar.id, {
        name: "No",
        kind: "free",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("keeps paid memberships pending without collecting payment", async () => {
    const { memberships, calendar, notifications } = await setup();
    const tier = await memberships.createTier(owner, calendar.id, {
      name: "Patron",
      kind: "subscription",
      requiresApproval: true,
      priceCents: 2000,
      currency: "EUR",
      interval: "month",
    });

    const requested = await memberships.requestJoin("fan_1", calendar.id, tier.id);
    expect(requested.status).toBe("pending");
    expect(requested.paymentExternalId).toBeNull();
    expect(notifications).toContain("membership.requested");

    const outsider: Actor = { userId: "x", organizationId: "org_2", role: "owner" };
    await expect(memberships.decide(outsider, requested.id, "approved")).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const approved = await memberships.decide(owner, requested.id, "approved");
    expect(approved.status).toBe("awaiting_payment");
    expect(notifications).toContain("membership.approved");

    await expect(
      memberships.startPayment("fan_1", approved.id, {
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
      }),
    ).rejects.toBeInstanceOf(PaymentNotConfiguredError);
  });

  it("activates a free approved membership", async () => {
    const { memberships, calendar } = await setup();
    const tier = await memberships.createTier(owner, calendar.id, {
      name: "Friends",
      kind: "free",
      requiresApproval: true,
    });
    const requested = await memberships.requestJoin("fan_2", calendar.id, tier.id);
    const approved = await memberships.decide(owner, requested.id, "approved");
    expect(approved.status).toBe("active");
  });

  it("records a rejection", async () => {
    const { memberships, calendar, notifications } = await setup();
    const tier = await memberships.createTier(owner, calendar.id, {
      name: "Waitlist",
      kind: "tier_gated",
      requiresApproval: true,
    });
    const requested = await memberships.requestJoin("fan_3", calendar.id, tier.id);
    const rejected = await memberships.decide(owner, requested.id, "rejected");
    expect(rejected.status).toBe("rejected");
    expect(notifications).toContain("membership.rejected");
  });
});
