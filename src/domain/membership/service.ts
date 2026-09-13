import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import { canAssignRole, canManageMember, type OrganizationRole } from "@/domain/rbac/roles";
import type {
  InvitationRepository,
  MembershipRepository,
  OrganizationInvitation,
  OrganizationMember,
  UserDirectory,
} from "@/domain/organization/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { randomToken, sha256 } from "@/lib/token-crypto";

export type MembershipServiceDeps = {
  members: MembershipRepository;
  invitations: InvitationRepository;
  users: UserDirectory;
  clock?: Clock;
  ids?: IdGenerator;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createMembershipService(deps: MembershipServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function listMembers(actor: Actor) {
    assertPermission(actor.role, "members:read");
    return deps.members.listByOrganization(actor.organizationId);
  }

  async function ownersIn(organizationId: string) {
    const members = await deps.members.listByOrganization(organizationId);
    return members.filter((member) => member.role === "owner");
  }

  async function invite(
    actor: Actor,
    input: { email: string; role: OrganizationRole },
  ): Promise<{ invitation: OrganizationInvitation; token: string }> {
    assertPermission(actor.role, "members:invite");
    if (!canAssignRole(actor.role, input.role)) {
      throw new ForbiddenError("You cannot invite a member with that role");
    }

    const email = normalizeEmail(input.email);
    if (!email.includes("@")) {
      throw new ValidationError("A valid email is required");
    }

    const existingUser = await deps.users.findByEmail(email);
    if (existingUser) {
      const already = await deps.members.findByUserAndOrganization(
        existingUser.id,
        actor.organizationId,
      );
      if (already) {
        throw new ConflictError("This user is already a member");
      }
    }

    const now = clock.now();
    const token = randomToken();
    const invitation = await deps.invitations.create({
      id: ids.id(),
      organizationId: actor.organizationId,
      email,
      role: input.role,
      tokenHash: sha256(token),
      invitedByUserId: actor.userId,
      status: "pending",
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      acceptedAt: null,
      acceptedByUserId: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return { invitation, token };
  }

  async function acceptInvitation(input: {
    token: string;
    actorUserId: string;
  }): Promise<OrganizationMember> {
    const invitation = await deps.invitations.findByTokenHash(sha256(input.token));
    const now = clock.now();
    if (
      !invitation ||
      invitation.status !== "pending" ||
      invitation.revokedAt ||
      invitation.expiresAt <= now
    ) {
      throw new NotFoundError("Invitation");
    }

    const user = await deps.users.findById(input.actorUserId);
    if (!user || normalizeEmail(user.email) !== invitation.email) {
      throw new ForbiddenError("This invitation was issued to a different email");
    }

    const already = await deps.members.findByUserAndOrganization(
      user.id,
      invitation.organizationId,
    );
    if (already) {
      throw new ConflictError("You already belong to this organization");
    }

    const member = await deps.members.create({
      id: ids.id(),
      organizationId: invitation.organizationId,
      userId: user.id,
      role: invitation.role,
      createdAt: now,
      updatedAt: now,
    });

    await deps.invitations.save({
      ...invitation,
      status: "accepted",
      acceptedAt: now,
      acceptedByUserId: user.id,
      updatedAt: now,
    });

    return member;
  }

  async function updateMemberRole(
    actor: Actor,
    targetUserId: string,
    role: OrganizationRole,
  ) {
    assertPermission(actor.role, "members:update");
    if (!canAssignRole(actor.role, role)) {
      throw new ForbiddenError("You cannot assign that role");
    }

    const target = await deps.members.findByUserAndOrganization(
      targetUserId,
      actor.organizationId,
    );
    if (!target) {
      throw new NotFoundError("Member", targetUserId);
    }
    if (!canManageMember(actor.role, target.role)) {
      throw new ForbiddenError("You cannot change this member's role");
    }

    if (target.role === "owner" && role !== "owner") {
      const owners = await ownersIn(actor.organizationId);
      if (owners.length <= 1) {
        throw new ValidationError("An organization must keep at least one owner");
      }
    }

    return deps.members.update({
      ...target,
      role,
      updatedAt: clock.now(),
    });
  }

  async function removeMember(actor: Actor, targetUserId: string) {
    assertPermission(actor.role, "members:remove");
    const target = await deps.members.findByUserAndOrganization(
      targetUserId,
      actor.organizationId,
    );
    if (!target) {
      throw new NotFoundError("Member", targetUserId);
    }
    if (!canManageMember(actor.role, target.role)) {
      throw new ForbiddenError("You cannot remove this member");
    }
    if (target.role === "owner") {
      const owners = await ownersIn(actor.organizationId);
      if (owners.length <= 1) {
        throw new ValidationError("An organization must keep at least one owner");
      }
    }
    await deps.members.delete(target.id);
  }

  async function revokeInvitation(actor: Actor, invitationId: string) {
    assertPermission(actor.role, "members:invite");
    const invitation = await deps.invitations.findById(invitationId);
    if (!invitation || invitation.organizationId !== actor.organizationId) {
      throw new NotFoundError("Invitation", invitationId);
    }
    if (invitation.status !== "pending") {
      throw new ConflictError("Only pending invitations can be revoked");
    }
    const now = clock.now();
    return deps.invitations.save({
      ...invitation,
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    });
  }

  return {
    listMembers,
    invite,
    acceptInvitation,
    updateMemberRole,
    removeMember,
    revokeInvitation,
  };
}
