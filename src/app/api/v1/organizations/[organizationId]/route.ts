import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import {
  AUDIT_RETENTION_MAX_DAYS,
  AUDIT_RETENTION_MIN_DAYS,
  BILLING_MODES,
  FUNCTIONAL_LEVELS,
} from "@/domain/organization/types";
import { getServices } from "@/server/container";

const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(80).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  secondaryColor: z.string().nullable().optional(),
  functionalLevel: z.enum(FUNCTIONAL_LEVELS).optional(),
  billingMode: z.enum(BILLING_MODES).optional(),
  auditRetentionDays: z
    .number()
    .int()
    .min(AUDIT_RETENTION_MIN_DAYS)
    .max(AUDIT_RETENTION_MAX_DAYS)
    .optional(),
  kind: z.enum(["standard", "agency"]).optional(),
});

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId);
    const organization = await services.organizations.getOrganization(actor);
    const usage = await services.organizations.calendarUsage(organization.id);
    return jsonOk({ ...organization, calendarUsage: usage }, { requestId });
  })(request);

export const PATCH = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const body = updateOrganizationSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId);
    const before = await services.organizations.getOrganization(actor);
    const organization = await services.organizations.updateOrganization(actor, body);

    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "organization.update",
      resourceType: "organization",
      resourceId: organization.id,
      metadata: body,
      before,
      after: organization,
      requestId,
      ...requestAuditContext(request),
    });

    return jsonOk(organization, { requestId });
  })(request);
