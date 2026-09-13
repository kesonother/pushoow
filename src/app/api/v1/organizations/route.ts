import { z } from "zod";
import { paginateById, parsePageQuery } from "@/api/pagination";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).optional(),
});

export const GET = withApi(async ({ user, url, requestId }) => {
  const services = getServices();
  const organizations = await services.organizations.listOrganizationsForUser(user!.id);
  const page = paginateById(organizations, parsePageQuery(url.searchParams));
  return jsonOk(page, { requestId });
});

export const POST = withApi(
  async ({ user, request, requestId }) => {
    const body = createOrganizationSchema.parse(await readJson(request));
    const services = getServices();
    const organization = await services.organizations.createOrganization({
      actorUserId: user!.id,
      name: body.name,
      slug: body.slug,
    });

    await writeAuditLog(services.db, {
      organizationId: organization.id,
      actorUserId: user!.id,
      action: "organization.create",
      resourceType: "organization",
      resourceId: organization.id,
      requestId,
    });

    return jsonOk(organization, { status: 201, requestId });
  },
  {
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
);
