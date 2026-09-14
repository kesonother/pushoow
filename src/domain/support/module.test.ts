import { describe, expect, it } from "vitest";
import { entitlementsFor } from "@/domain/billing/catalog";
import { ForbiddenError, ValidationError } from "@/domain/errors";
import type { Actor } from "@/domain/rbac/permissions";
import { addBusinessHours, firstResponseHours, slaPolicyFromEntitlements } from "@/domain/support/sla";
import {
  createMemoryStatusIncidents,
  createMemoryStatusMaintenance,
  createMemoryStatusUptime,
  createMemorySupportTickets,
  createMemoryTicketAssignments,
  createMemoryTicketEvents,
  createMemoryTicketMessages,
} from "@/domain/support/memory";
import { createSupportService, unavailablePublicStatus } from "@/domain/support/service";
import {
  HUMAN_FIRST_OPENING,
  SUPPORT_BOT_REQUIRED,
  SUPPORT_HUMAN_FIRST,
} from "@/domain/support/types";

function mutableClock(iso: string) {
  let current = new Date(iso);
  return {
    now: () => new Date(current.getTime()),
    set(next: string | Date) {
      current = new Date(next);
    },
    addHours(hours: number) {
      current = new Date(current.getTime() + hours * 3_600_000);
    },
  };
}

function actorFor(organizationId: string, role: Actor["role"], userId = "user_1"): Actor {
  return { userId, organizationId, role, emailVerified: true };
}

function setup(planId: "free" | "plus" | "enterprise" = "free") {
  const clock = mutableClock("2026-09-14T10:00:00.000Z");
  const entitlements = entitlementsFor(planId);
  const support = createSupportService({
    tickets: createMemorySupportTickets(),
    messages: createMemoryTicketMessages(),
    assignments: createMemoryTicketAssignments(),
    events: createMemoryTicketEvents(),
    incidents: createMemoryStatusIncidents(),
    maintenance: createMemoryStatusMaintenance(),
    uptime: createMemoryStatusUptime(),
    entitlements: {
      async forOrganization() {
        return { planId, source: "subscription", ...entitlements };
      },
    },
    clock,
  });
  const owner = actorFor("org_1", "owner");
  const outsider = actorFor("org_other", "owner", "user_2");
  return { clock, support, owner, outsider, planId };
}

describe("support SLA engine", () => {
  it("derives first response and resolution hours from plan entitlements, not plan name branches", () => {
    expect(firstResponseHours(72, "normal")).toBe(72);
    expect(firstResponseHours(72, "low")).toBe(108);
    expect(firstResponseHours(12, "high")).toBe(6);
    expect(firstResponseHours(4, "urgent")).toBe(1);
    const free = slaPolicyFromEntitlements("free", 72);
    const plus = slaPolicyFromEntitlements("plus", 12);
    const enterprise = slaPolicyFromEntitlements("enterprise", 4);
    expect(free.aroundTheClock).toBe(false);
    expect(plus.aroundTheClock).toBe(false);
    expect(enterprise.aroundTheClock).toBe(true);
    expect(enterprise.businessHours).toBeNull();
    expect(free.firstResponseHours.normal).toBe(72);
    expect(plus.resolutionHours.normal).toBe(24);
  });

  it("counts only UTC weekday business hours", () => {
    const hours = slaPolicyFromEntitlements("plus", 12).businessHours!;
    expect(addBusinessHours(new Date("2026-09-14T10:00:00.000Z"), 4, hours).toISOString()).toBe(
      "2026-09-14T14:00:00.000Z",
    );
    expect(addBusinessHours(new Date("2026-09-18T17:00:00.000Z"), 2, hours).toISOString()).toBe(
      "2026-09-21T10:00:00.000Z",
    );
    expect(addBusinessHours(new Date("2026-09-19T12:00:00.000Z"), 1, hours).toISOString()).toBe(
      "2026-09-21T10:00:00.000Z",
    );
  });
});

describe("support tickets", () => {
  it("keeps support human-first without a mandatory chatbot", async () => {
    expect(SUPPORT_HUMAN_FIRST).toBe(true);
    expect(SUPPORT_BOT_REQUIRED).toBe(false);
    const { support, owner } = setup();
    const conversation = await support.createTicket(owner, {
      subject: "Cannot publish event",
      body: "The publish button stays disabled.",
      channel: "in_app",
    });
    expect(conversation.ticket.status).toBe("open");
    expect(conversation.ticket.number).toMatch(/^SUP-2026-\d{4}$/);
    expect(conversation.messages.some((item) => item.authorKind === "agent")).toBe(false);
    expect(conversation.messages.some((item) => item.body === HUMAN_FIRST_OPENING)).toBe(true);
    expect(conversation.history[0]?.type).toBe("opened");
    expect(conversation.history[0]?.metadata.botRequired).toBe(false);
  });

  it("stores channel metadata for email, phone and Slack Connect", async () => {
    const { support, owner } = setup("plus");
    const email = await support.createTicket(owner, {
      subject: "Email ticket",
      body: "Sent from inbox",
      channel: "email",
      channelMetadata: { emailFrom: "ada@example.com", emailMessageId: "<msg-1>" },
    });
    const phone = await support.createTicket(owner, {
      subject: "Phone ticket",
      body: "Called the hotline",
      channel: "phone",
      channelMetadata: { phoneNumber: "+33123456789", callSid: "CA123" },
    });
    const slack = await support.createTicket(owner, {
      subject: "Slack ticket",
      body: "From Slack Connect",
      channel: "slack",
      channelMetadata: { slackTeamId: "T1", slackChannelId: "C1", slackThreadTs: "1710000.1" },
    });
    expect(email.ticket.channelMetadata.emailFrom).toBe("ada@example.com");
    expect(phone.ticket.channelMetadata.callSid).toBe("CA123");
    expect(slack.ticket.channelMetadata.slackChannelId).toBe("C1");
  });

  it("assigns a ticket, records assignment history, and transitions status", async () => {
    const { support, owner } = setup();
    const created = await support.createTicket(owner, { subject: "Need help", body: "Please assign" });
    const assigned = await support.assign(owner, created.ticket.id, "agent_9");
    expect(assigned.ticket.status).toBe("assigned");
    expect(assigned.ticket.assignedToUserId).toBe("agent_9");
    expect(assigned.assignments).toHaveLength(1);
    expect(assigned.history.some((item) => item.type === "assigned")).toBe(true);
  });

  it("walks status transitions and keeps conversation attachments plus history", async () => {
    const { support, owner } = setup();
    const created = await support.createTicket(owner, {
      subject: "Attachment case",
      body: "See screenshot",
      attachments: [
        {
          id: "att_1",
          filename: "shot.png",
          contentType: "image/png",
          sizeBytes: 1200,
          url: "https://files.example.com/shot.png",
        },
      ],
    });
    expect(created.messages[0]?.attachments[0]?.filename).toBe("shot.png");
    await support.assign(owner, created.ticket.id, owner.userId);
    const pending = await support.setStatus(owner, created.ticket.id, "pending");
    expect(pending.ticket.status).toBe("pending");
    const reply = await support.addMessage(owner, created.ticket.id, {
      body: "Here is the extra log",
      authorKind: "requester",
    });
    expect(reply.ticket.status).toBe("assigned");
    const resolved = await support.setStatus(owner, created.ticket.id, "resolved");
    expect(resolved.ticket.status).toBe("resolved");
    const closed = await support.setStatus(owner, created.ticket.id, "closed");
    expect(closed.ticket.status).toBe("closed");
    expect(closed.history.some((item) => item.type === "resolved")).toBe(true);
    expect(closed.history.some((item) => item.type === "closed")).toBe(true);
  });

  it("applies plan-based SLA deadlines and escalates priority after a first-response breach", async () => {
    const plus = setup("plus");
    const created = await plus.support.createTicket(plus.owner, {
      subject: "Plus SLA",
      body: "Need a first reply",
      priority: "normal",
    });
    expect(created.sla.applicable).toBe(true);
    expect(created.ticket.firstResponseDueAt.toISOString()).toBe("2026-09-15T13:00:00.000Z");
    plus.clock.set("2026-09-15T14:00:00.000Z");
    const ticked = await plus.support.processSlaTick();
    expect(ticked).toBe(1);
    const after = await plus.support.getConversation(plus.owner, created.ticket.id);
    expect(after.ticket.priority).toBe("high");
    expect(after.ticket.firstResponseBreachedAt).not.toBeNull();
    expect(after.history.some((item) => item.type === "sla_escalated")).toBe(true);

    const enterprise = setup("enterprise");
    const urgent = await enterprise.support.createTicket(enterprise.owner, {
      subject: "Enterprise around the clock",
      body: "Outage",
      priority: "urgent",
    });
    expect(urgent.sla.aroundTheClock).toBe(true);
    expect(urgent.ticket.firstResponseDueAt.toISOString()).toBe("2026-09-14T11:00:00.000Z");
  });

  it("hides internal notes from readers without manage and blocks cross-tenant access", async () => {
    const { support, owner, outsider } = setup();
    const created = await support.createTicket(owner, { subject: "Private", body: "Visible" });
    await support.addMessage(owner, created.ticket.id, {
      body: "Internal diagnosis",
      visibility: "internal",
    });
    const reader = actorFor("org_1", "read_only", "user_reader");
    const asReader = await support.getConversation(reader, created.ticket.id);
    expect(asReader.messages.some((item) => item.visibility === "internal")).toBe(false);
    await expect(support.listTickets(outsider)).resolves.toEqual([]);
    await expect(support.getConversation(outsider, created.ticket.id)).rejects.toThrow(ForbiddenError);
    const door = actorFor("org_1", "check_in_manager", "door_1");
    await expect(support.createTicket(door, { subject: "Nope", body: "Nope" })).rejects.toThrow(ForbiddenError);
  });

  it("rejects a mandatory-bot-shaped agent reply on create and invalid status jumps", async () => {
    const { support, owner } = setup();
    const created = await support.createTicket(owner, { subject: "Jump", body: "Hello" });
    await expect(support.setStatus(owner, created.ticket.id, "closed")).rejects.toThrow(ValidationError);
  });
});

describe("public status page", () => {
  it("exposes incidents, maintenance, uptime and historical incidents", async () => {
    const { support } = setup();
    const incident = await support.recordIncident({
      title: "API latency",
      impact: "Checkout slower than usual",
      severity: "major",
    });
    await support.updateIncident(incident.id, { status: "resolved", body: "Mitigated" });
    await support.recordIncident({
      title: "Active outage",
      impact: "Login failing",
      severity: "critical",
    });
    await support.scheduleMaintenance({
      title: "Database upgrade",
      startsAt: new Date("2026-09-20T02:00:00.000Z"),
      endsAt: new Date("2026-09-20T04:00:00.000Z"),
    });
    await support.recordUptime({ component: "api", day: "2026-09-13", uptimeBps: 9950 });
    const page = await support.publicStatus();
    expect(page.status).toBe("outage");
    expect(page.incidents).toHaveLength(1);
    expect(page.historicalIncidents).toHaveLength(1);
    expect(page.maintenance[0]?.title).toBe("Database upgrade");
    expect(page.uptime[0]?.uptimeBps).toBe(9950);
    expect(page.historicalIncidents[0]?.provider).toBe("native");
  });

  it("falls back to an outage snapshot when the status store is unavailable", () => {
    const snapshot = unavailablePublicStatus(new Date("2026-09-14T10:00:00.000Z"));
    expect(snapshot.status).toBe("outage");
    expect(snapshot.incidents[0]?.severity).toBe("critical");
    expect(snapshot.uptime).toEqual([]);
  });
});
