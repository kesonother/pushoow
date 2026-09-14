import { describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/domain/errors";
import { createAccessService } from "@/domain/access/service";
import { createAgencyService } from "@/domain/agency/service";
import { createAuditService } from "@/domain/audit/service";
import { createCalendarService } from "@/domain/calendar/service";
import { createCustomRoleService } from "@/domain/custom-role/service";
import { createMembershipService } from "@/domain/membership/service";
import { createOrganizationService } from "@/domain/organization/service";
import { AUDIT_RETENTION_MIN_DAYS, calendarLimitFor } from "@/domain/organization/types";
import { permissionsFromGrants } from "@/domain/rbac/grants";
import { assertPermission, hasPermission } from "@/domain/rbac/permissions";
import type { Actor } from "@/domain/rbac/permissions";
import type {
  InvitationRepository,
  OrganizationInvitation,
  UserDirectory,
} from "@/domain/organization/types";
import {
  createMemoryAgencyClients,
  createMemoryAuditLogs,
  createMemoryCalendars,
  createMemoryCustomRoles,
  createMemoryMembers,
  createMemoryOrganizations,
} from "@/test/fakes";

function memoryInvitations(): InvitationRepository {
  const items = new Map<string, OrganizationInvitation>();
  return {
    async create(invitation) {
      items.set(invitation.id, invitation);
      return invitation;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByTokenHash(tokenHash) {
      return [...items.values()].find((item) => item.tokenHash === tokenHash) ?? null;
    },
    async listByOrganization(organizationId) {
      return [...items.values()].filter((item) => item.organizationId === organizationId);
    },
    async save(invitation) {
      items.set(invitation.id, invitation);
      return invitation;
    },
  };
}

function users(): UserDirectory {
  const rows = [
    { id: "user_owner", email: "owner@example.com", emailVerified: true },
    { id: "user_invitee", email: "invitee@example.com", emailVerified: true },
    { id: "user_other", email: "other@example.com", emailVerified: true },
  ];
  return {
    async findById(id) {
      return rows.find((row) => row.id === id) ?? null;
    },
    async findByEmail(email) {
      return rows.find((row) => row.email === email.toLowerCase()) ?? null;
    },
  };
}

function setup() {
  const organizations = createMemoryOrganizations();
  const members = createMemoryMembers();
  const customRoles = createMemoryCustomRoles();
  const agencyClients = createMemoryAgencyClients();
  const calendars = createMemoryCalendars();
  const audit = createMemoryAuditLogs();
  const orgs = createOrganizationService({ organizations, members, calendars });
  const agency = createAgencyService({ organizations, agencyClients });
  const access = createAccessService({ members, organizations, customRoles, agencyClients });
  const roles = createCustomRoleService({ roles: customRoles, members });
  const memberships = createMembershipService({
    members,
    invitations: memoryInvitations(),
    users: users(),
    customRoles,
  });
  const calendarService = createCalendarService({
    calendars,
    limits: { forOrganization: (id) => orgs.calendarUsage(id) },
    organizationBranding: async (id) => {
      const org = await organizations.findById(id);
      return org ? { logoUrl: org.logoUrl, primaryColor: org.primaryColor } : null;
    },
  });
  const audits = createAuditService({ audit, organizations });
  return {
    organizations,
    members,
    orgs,
    agency,
    access,
    roles,
    memberships,
    calendarService,
    audits,
  };
}

describe("enterprise organization model", () => {
  it("creates organizations with branding, billing, and calendar limits", async () => {
    const { orgs } = setup();
    const created = await orgs.createOrganization({ actorUserId: "user_owner", name: "Studio" });
    expect(created.kind).toBe("standard");
    expect(created.functionalLevel).toBe("free");
    expect(created.logoUrl).toBeNull();
    expect(created.billingMode).toBe("own");
    expect(created.auditRetentionDays).toBe(365);

    const updated = await orgs.updateOrganization(
      { userId: "user_owner", organizationId: created.id, role: "owner" },
      { logoUrl: "https://cdn.example.com/logo.png", primaryColor: "#112233", functionalLevel: "enterprise" },
    );
    expect(updated.logoUrl).toBe("https://cdn.example.com/logo.png");
    expect(updated.primaryColor).toBe("#112233");
    expect(calendarLimitFor(updated.functionalLevel)).toBe(50);
  });

  it("rejects audit retention below the minimum", async () => {
    const { orgs } = setup();
    const created = await orgs.createOrganization({ actorUserId: "user_owner", name: "Keep" });
    await expect(
      orgs.updateOrganization(
        { userId: "user_owner", organizationId: created.id, role: "owner" },
        { auditRetentionDays: AUDIT_RETENTION_MIN_DAYS - 1 },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("enforces calendar quotas by functional level", async () => {
    const { orgs, calendarService } = setup();
    const created = await orgs.createOrganization({ actorUserId: "user_owner", name: "Quota" });
    const actor: Actor = { userId: "user_owner", organizationId: created.id, role: "owner" };
    await calendarService.createCalendar(actor, { name: "One" });
    await calendarService.createCalendar(actor, { name: "Two" });
    await calendarService.createCalendar(actor, { name: "Three" });
    await expect(calendarService.createCalendar(actor, { name: "Four" })).rejects.toBeInstanceOf(
      ValidationError,
    );

    await orgs.updateOrganization(actor, { functionalLevel: "pro" });
    const fourth = await calendarService.createCalendar(actor, { name: "Four" });
    expect(fourth.organizationId).toBe(created.id);
  });

  it("inherits organization branding on new calendars", async () => {
    const { orgs, calendarService } = setup();
    const created = await orgs.createOrganization({ actorUserId: "user_owner", name: "Brand" });
    const actor: Actor = { userId: "user_owner", organizationId: created.id, role: "owner" };
    await orgs.updateOrganization(actor, {
      logoUrl: "https://cdn.example.com/org.png",
      primaryColor: "#abcdef",
    });
    const calendar = await calendarService.createCalendar(actor, { name: "Inherited" });
    expect(calendar.logoUrl).toBe("https://cdn.example.com/org.png");
    expect(calendar.primaryColor).toBe("#abcdef");
  });

  it("maps custom grants to permissions and honors them on the actor", async () => {
    expect(permissionsFromGrants(["manage_events", "checkin"])).toEqual(
      expect.arrayContaining(["events:publish", "checkin:manage", "organization:read"]),
    );
    const actor: Actor = {
      userId: "user_custom",
      organizationId: "org_1",
      role: "custom",
      permissions: permissionsFromGrants(["manage_registrants"]),
    };
    expect(hasPermission(actor, "registrants:manage")).toBe(true);
    expect(() => assertPermission(actor, "members:invite")).toThrow(ForbiddenError);
  });

  it("invites a custom role and copies grants onto the membership", async () => {
    const { orgs, roles, memberships, access } = setup();
    const created = await orgs.createOrganization({ actorUserId: "user_owner", name: "Roles" });
    const actor: Actor = { userId: "user_owner", organizationId: created.id, role: "owner" };
    const role = await roles.create(actor, { name: "Door+", grants: ["checkin", "manage_registrants"] });
    const { token } = await memberships.invite(actor, {
      email: "invitee@example.com",
      role: "custom",
      customRoleId: role.id,
    });
    const member = await memberships.acceptInvitation({ token, actorUserId: "user_invitee" });
    expect(member.role).toBe("custom");
    expect(member.customRoleId).toBe(role.id);
    const resolved = await access.resolve("user_invitee", created.id);
    expect(hasPermission(resolved, "checkin:manage")).toBe(true);
    expect(hasPermission(resolved, "finance:write")).toBe(false);
  });

  it("records audit logs with actor, IP, UA, and before/after then exports CSV", async () => {
    const { orgs, audits } = setup();
    const created = await orgs.createOrganization({ actorUserId: "user_owner", name: "Logs" });
    const actor: Actor = { userId: "user_owner", organizationId: created.id, role: "owner" };
    await audits.record({
      organizationId: created.id,
      actorUserId: actor.userId,
      action: "organization.update",
      resourceType: "organization",
      resourceId: created.id,
      ipAddress: "203.0.113.8",
      userAgent: "vitest",
      before: { name: "Logs" },
      after: { name: "Logs HQ" },
    });
    const listed = await audits.list(actor);
    expect(listed[0]?.ipAddress).toBe("203.0.113.8");
    expect(listed[0]?.userAgent).toBe("vitest");
    expect(listed[0]?.before).toEqual({ name: "Logs" });
    const csv = await audits.exportCsv(actor);
    expect(csv).toContain("actor,timestamp,ip,userAgent,action,target,before,after");
    expect(csv).toContain("203.0.113.8");
    expect(csv).toContain("Logs HQ");
  });

  it("purges audit logs according to the configured retention minimum", async () => {
    const { orgs, audits } = setup();
    const created = await orgs.createOrganization({ actorUserId: "user_owner", name: "Retention" });
    const actor: Actor = { userId: "user_owner", organizationId: created.id, role: "owner" };
    await orgs.updateOrganization(actor, { auditRetentionDays: AUDIT_RETENTION_MIN_DAYS });
    const now = new Date("2026-09-14T00:00:00.000Z");
    await audits.record({
      organizationId: created.id,
      actorUserId: actor.userId,
      action: "old",
      resourceType: "organization",
      resourceId: created.id,
    });
    const listed = await audits.list(actor);
    listed[0]!.createdAt = new Date("2026-01-01T00:00:00.000Z");
    const removed = await createAuditService({
      audit: {
        async create(log) {
          return log;
        },
        async listByOrganization() {
          return listed;
        },
        async purgeExpired(when, policies) {
          expect(policies[0]?.retentionDays).toBe(AUDIT_RETENTION_MIN_DAYS);
          const cutoff = new Date(when.getTime() - AUDIT_RETENTION_MIN_DAYS * 24 * 60 * 60 * 1000);
          return listed[0]!.createdAt < cutoff ? 1 : 0;
        },
      },
      organizations: {
        async listRetentionPolicies() {
          return [{ id: created.id, auditRetentionDays: AUDIT_RETENTION_MIN_DAYS }];
        },
      },
      clock: { now: () => now },
    }).purgeExpired();
    expect(removed).toBe(1);
  });

  it("lets an agency manage a client without leaking another client", async () => {
    const { orgs, agency, access, calendarService, members } = setup();
    const agencyOrg = await orgs.createOrganization({
      actorUserId: "user_owner",
      name: "Agency Co",
      kind: "agency",
    });
    const agencyActor: Actor = { userId: "user_owner", organizationId: agencyOrg.id, role: "owner" };
    const converted = await agency.convertToAgency(agencyActor);
    expect(converted.kind).toBe("agency");

    const clientA = await agency.createClient(agencyActor, { name: "Client A" });
    const clientB = await agency.createClient(agencyActor, { name: "Client B" });
    expect(clientA.kind).toBe("client");
    expect(clientA.billingMode).toBe("consolidated");
    expect(clientA.billingOrganizationId).toBe(agencyOrg.id);
    expect(clientA.agencyOrganizationId).toBe(agencyOrg.id);

    await orgs.updateOrganization(
      { userId: "user_owner", organizationId: clientA.id, role: "admin", viaAgency: true },
      { logoUrl: "https://a.example/logo.png", primaryColor: "#aaaaaa" },
    );
    await orgs.updateOrganization(
      { userId: "user_owner", organizationId: clientB.id, role: "admin", viaAgency: true },
      { logoUrl: "https://b.example/logo.png", primaryColor: "#bbbbbb" },
    );

    const overlayA = await access.resolve("user_owner", clientA.id);
    expect(overlayA.organizationId).toBe(clientA.id);
    expect(overlayA.viaAgency).toBe(true);
    expect(overlayA.role).toBe("admin");
    expect(hasPermission(overlayA, "organization:delete")).toBe(false);

    const calA = await calendarService.createCalendar(overlayA, { name: "A cal" });
    expect(calA.organizationId).toBe(clientA.id);
    expect(calA.logoUrl).toBe("https://a.example/logo.png");

    const overlayB = await access.resolve("user_owner", clientB.id);
    await expect(calendarService.getCalendar(overlayA, calA.id)).resolves.toMatchObject({
      organizationId: clientA.id,
    });
    await expect(calendarService.getCalendar(overlayB, calA.id)).rejects.toBeInstanceOf(ForbiddenError);

    const clientMembers = await members.listByOrganization(clientA.id);
    expect(clientMembers.some((item) => item.userId === "user_owner")).toBe(false);

    const accessible = await access.listAccessible("user_owner");
    expect(accessible.map((item) => item.organization.id).sort()).toEqual(
      [agencyOrg.id, clientA.id, clientB.id].sort(),
    );
  });

  it("blocks agency access when the client link is missing", async () => {
    const { orgs, access } = setup();
    const agencyOrg = await orgs.createOrganization({
      actorUserId: "user_owner",
      name: "Agency",
      kind: "agency",
    });
    const stranger = await orgs.createOrganization({ actorUserId: "user_other", name: "Stranger" });
    await expect(access.resolve("user_owner", stranger.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(access.resolve("user_other", agencyOrg.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
