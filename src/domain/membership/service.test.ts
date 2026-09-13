import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/domain/errors";
import { createMembershipService } from "@/domain/membership/service";
import type { Actor } from "@/domain/rbac/permissions";
import type {
  InvitationRepository,
  OrganizationInvitation,
  UserDirectory,
} from "@/domain/organization/types";
import { createMemoryMembers } from "@/test/fakes";

const owner: Actor = { userId: "user_owner", organizationId: "org_1", role: "owner" };
const admin: Actor = { userId: "user_admin", organizationId: "org_1", role: "admin" };
const outsider: Actor = { userId: "user_out", organizationId: "org_2", role: "owner" };

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
    { id: "user_admin", email: "admin@example.com", emailVerified: true },
    { id: "user_invitee", email: "invitee@example.com", emailVerified: false },
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

async function setup() {
  const members = createMemoryMembers();
  await members.create({
    id: "mem_owner",
    organizationId: "org_1",
    userId: "user_owner",
    role: "owner",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await members.create({
    id: "mem_admin",
    organizationId: "org_1",
    userId: "user_admin",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const svc = createMembershipService({
    members,
    invitations: memoryInvitations(),
    users: users(),
  });
  return { svc, members };
}

describe("membership and invitations", () => {
  it("lets a user belong to several organizations with distinct roles", async () => {
    const { members } = await setup();
    await members.create({
      id: "mem_other",
      organizationId: "org_2",
      userId: "user_admin",
      role: "read_only",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const roles = await members.listByUser("user_admin");
    expect(roles.map((item) => [item.organizationId, item.role])).toEqual([
      ["org_1", "admin"],
      ["org_2", "read_only"],
    ]);
  });

  it("blocks privilege escalation when inviting or changing roles", async () => {
    const { svc } = await setup();
    await expect(svc.invite(admin, { email: "x@example.com", role: "owner" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(svc.updateMemberRole(admin, "user_owner", "editor")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(svc.updateMemberRole(admin, "user_admin", "owner")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("rejects cross-organization member reads", async () => {
    const { svc } = await setup();
    const listed = await svc.listMembers(outsider);
    expect(listed).toEqual([]);
  });

  it("accepts an invitation only for the invited email", async () => {
    const { svc } = await setup();
    const { token } = await svc.invite(owner, {
      email: "invitee@example.com",
      role: "editor",
    });
    await expect(
      svc.acceptInvitation({ token, actorUserId: "user_other" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const member = await svc.acceptInvitation({ token, actorUserId: "user_invitee" });
    expect(member.role).toBe("editor");
    expect(member.organizationId).toBe("org_1");
  });
});
