import type { OrganizationRole } from "@/domain/rbac/roles";

export type Organization = {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type OrganizationMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationRepository = {
  create: (organization: Organization) => Promise<Organization>;
  findById: (id: string) => Promise<Organization | null>;
  findBySlug: (slug: string) => Promise<Organization | null>;
  listByIds: (ids: string[]) => Promise<Organization[]>;
  update: (organization: Organization) => Promise<Organization>;
};

export type MembershipRepository = {
  create: (member: OrganizationMember) => Promise<OrganizationMember>;
  findByUserAndOrganization: (
    userId: string,
    organizationId: string,
  ) => Promise<OrganizationMember | null>;
  listByUser: (userId: string) => Promise<OrganizationMember[]>;
  listByOrganization: (organizationId: string) => Promise<OrganizationMember[]>;
  update: (member: OrganizationMember) => Promise<OrganizationMember>;
  delete: (id: string) => Promise<void>;
};

export const INVITATION_STATUSES = ["pending", "accepted", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export type OrganizationInvitation = {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  tokenHash: string;
  invitedByUserId: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InvitationRepository = {
  create: (invitation: OrganizationInvitation) => Promise<OrganizationInvitation>;
  findById: (id: string) => Promise<OrganizationInvitation | null>;
  findByTokenHash: (tokenHash: string) => Promise<OrganizationInvitation | null>;
  listByOrganization: (organizationId: string) => Promise<OrganizationInvitation[]>;
  save: (invitation: OrganizationInvitation) => Promise<OrganizationInvitation>;
};

export type UserDirectory = {
  findById: (id: string) => Promise<{ id: string; email: string; emailVerified: boolean } | null>;
  findByEmail: (
    email: string,
  ) => Promise<{ id: string; email: string; emailVerified: boolean } | null>;
};
