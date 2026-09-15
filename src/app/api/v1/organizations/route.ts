import { cookies } from "next/headers";
import { z } from "zod";
import { paginateById, parsePageQuery } from "@/api/pagination";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { REFERRAL_COOKIE } from "@/domain/referral/types";
import { getServices } from "@/server/container";

const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).optional(),
  kind: z.enum(["standard", "agency"]).optional(),
});

export const GET = withApi(async ({ user, url, requestId }) => {
  const services = getServices();
  const accessible = await services.access.listAccessible(user!.id, user!.emailVerified);
  const page = paginateById(
    accessible.map((item) => item.organization),
    parsePageQuery(url.searchParams),
  );
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
      kind: body.kind,
    });

    await writeAuditLog(services.db, {
      organizationId: organization.id,
      actorUserId: user!.id,
      action: "organization.create",
      resourceType: "organization",
      resourceId: organization.id,
      requestId,
    });

    try {
      const code = (await cookies()).get(REFERRAL_COOKIE)?.value;
      if (code) {
        await services.referrals.attributeOrganizer({
          code,
          userId: user!.id,
          organizationId: organization.id,
        });
      }
    } catch {
      /* referral must not block organization creation */
    }

    return jsonOk(organization, { status: 201, requestId });
  },
  {
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
);
