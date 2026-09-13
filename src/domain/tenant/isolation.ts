import { ForbiddenError, NotFoundError } from "@/domain/errors";

export type TenantScoped = {
  organizationId: string;
  deletedAt?: Date | null;
};

/**
 * Never trust a client-supplied organizationId. Compare the resource's
 * persisted tenant with the actor's already-resolved membership.
 */
export function assertSameTenant(
  resource: TenantScoped | null | undefined,
  actorOrganizationId: string,
  resourceName = "Resource",
): asserts resource is TenantScoped {
  if (!resource || resource.deletedAt) {
    throw new NotFoundError(resourceName);
  }

  if (resource.organizationId !== actorOrganizationId) {
    throw new ForbiddenError("Cross-tenant access is not allowed");
  }
}

export function belongsToTenant(
  resource: TenantScoped | null | undefined,
  organizationId: string,
): boolean {
  return Boolean(
    resource && !resource.deletedAt && resource.organizationId === organizationId,
  );
}
