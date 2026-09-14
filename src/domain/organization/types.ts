import type { OrganizationRole } from "@/domain/rbac/roles";
import type { CustomGrant } from "@/domain/rbac/grants";

export const ORGANIZATION_KINDS = ["standard", "agency", "client"] as const;
export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

export const FUNCTIONAL_LEVELS = ["free", "pro", "plus", "enterprise"] as const;
export type FunctionalLevel = (typeof FUNCTIONAL_LEVELS)[number];

export const BILLING_MODES = ["own", "consolidated"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export const CALENDAR_LIMITS: Record<FunctionalLevel, number> = {
  free: 3,
  pro: 10,
  plus: 25,
  enterprise: 50,
};

export const AUDIT_RETENTION_MIN_DAYS = 90;
export const AUDIT_RETENTION_DEFAULT_DAYS = 365;
export const AUDIT_RETENTION_MAX_DAYS = 2555;

export type OrganizationBranding = {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

export type Organization = OrganizationBranding & {
  id: string;
  slug: string;
  name: string;
  kind: OrganizationKind;
  agencyOrganizationId: string | null;
  functionalLevel: FunctionalLevel;
  billingMode: BillingMode;
  billingOrganizationId: string | null;
  auditRetentionDays: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export function organizationDefaults(): OrganizationBranding &
  Pick<
    Organization,
    | "kind"
    | "agencyOrganizationId"
    | "functionalLevel"
    | "billingMode"
    | "billingOrganizationId"
    | "auditRetentionDays"
  > {
  return {
    kind: "standard",
    agencyOrganizationId: null,
    functionalLevel: "free",
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
    billingMode: "own",
    billingOrganizationId: null,
    auditRetentionDays: AUDIT_RETENTION_DEFAULT_DAYS,
  };
}

export function calendarLimitFor(level: FunctionalLevel): number {
  return CALENDAR_LIMITS[level];
}

export type OrganizationMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  customRoleId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationCustomRole = {
  id: string;
  organizationId: string;
  name: string;
  grants: CustomGrant[];
  createdAt: Date;
  updatedAt: Date;
};

export type AgencyClientLink = {
  id: string;
  agencyOrganizationId: string;
  clientOrganizationId: string;
  createdAt: Date;
};

export type OrganizationRepository = {
  create: (organization: Organization) => Promise<Organization>;
  findById: (id: string) => Promise<Organization | null>;
  findBySlug: (slug: string) => Promise<Organization | null>;
  listByIds: (ids: string[]) => Promise<Organization[]>;
  listByAgency: (agencyOrganizationId: string) => Promise<Organization[]>;
  listRetentionPolicies: () => Promise<Array<{ id: string; auditRetentionDays: number }>>;
  update: (organization: Organization) => Promise<Organization>;
};

export function billingOrganizationIdFor(organization: Organization): string {
  if (organization.billingMode === "consolidated" && organization.billingOrganizationId) {
    return organization.billingOrganizationId;
  }
  return organization.id;
}

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

export type CustomRoleRepository = {
  create: (role: OrganizationCustomRole) => Promise<OrganizationCustomRole>;
  findById: (id: string) => Promise<OrganizationCustomRole | null>;
  listByOrganization: (organizationId: string) => Promise<OrganizationCustomRole[]>;
  save: (role: OrganizationCustomRole) => Promise<OrganizationCustomRole>;
  delete: (id: string) => Promise<void>;
};

export type AgencyClientRepository = {
  create: (link: AgencyClientLink) => Promise<AgencyClientLink>;
  find: (agencyOrganizationId: string, clientOrganizationId: string) => Promise<AgencyClientLink | null>;
  listByAgency: (agencyOrganizationId: string) => Promise<AgencyClientLink[]>;
  listByClient: (clientOrganizationId: string) => Promise<AgencyClientLink[]>;
};

export const INVITATION_STATUSES = ["pending", "accepted", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export type OrganizationInvitation = {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  customRoleId?: string | null;
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
