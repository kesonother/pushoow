import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { PUBLIC_PLAN_IDS } from "@/domain/billing/types";
import { ValidationError } from "@/domain/errors";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

const quoteSchema = z.object({
  planId: z.enum(PUBLIC_PLAN_IDS),
  addOns: z.array(z.object({ id: z.string().min(1), quantity: z.number().int().min(1) })).optional(),
  address: z
    .object({
      country: z.string().min(2).max(2),
      postalCode: z.string().max(20).optional(),
    })
    .optional(),
});

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    return jsonOk(await services.billing.overview(actor), { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId, url, request: req }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const action = url.searchParams.get("action") ?? "quote";
    if (action === "quote") {
      const body = quoteSchema.parse(await readJson(req));
      return jsonOk(await services.billing.quoteChange(actor, body), { requestId });
    }
    if (action === "checkout") {
      const body = quoteSchema.parse(await readJson(req));
      const quote = await services.billing.quoteChange(actor, body);
      const result = await services.billing.startCheckout(actor, quote);
      await writeAuditLog(services.db, {
        organizationId: actor.organizationId,
        actorUserId: user!.id,
        action: `billing.${quote.change}`,
        resourceType: "subscription",
        resourceId: result.subscription.id,
        metadata: { planId: quote.toPlanId, totalCents: quote.totalCents },
        requestId,
        ...requestAuditContext(req),
      });
      return jsonOk(result, { requestId });
    }
    if (action === "cancel") {
      const cancellation = await services.billing.requestCancellation(actor);
      return jsonOk(
        {
          id: cancellation.id,
          status: cancellation.status,
          confirmationToken: cancellation.confirmationToken,
        },
        { requestId },
      );
    }
    if (action === "cancel-confirm") {
      const body = z.object({ token: z.string().min(8) }).parse(await readJson(req));
      const confirmed = await services.billing.confirmCancellation(actor, body.token);
      await writeAuditLog(services.db, {
        organizationId: actor.organizationId,
        actorUserId: user!.id,
        action: "billing.cancel",
        resourceType: "subscription",
        resourceId: confirmed.subscriptionId,
        requestId,
        ...requestAuditContext(req),
      });
      return jsonOk(
        {
          id: confirmed.id,
          status: confirmed.status,
          confirmedAt: confirmed.confirmedAt,
        },
        { requestId },
      );
    }
    if (action === "refund") {
      const body = z.object({ invoiceId: z.string().min(1) }).parse(await readJson(req));
      const invoice = await services.billing.requestRefund(actor, body.invoiceId);
      await writeAuditLog(services.db, {
        organizationId: actor.organizationId,
        actorUserId: user!.id,
        action: "billing.refund",
        resourceType: "invoice",
        resourceId: invoice.id,
        metadata: { refundedCents: invoice.refundedCents },
        requestId,
        ...requestAuditContext(req),
      });
      return jsonOk(invoice, { requestId });
    }
    throw new ValidationError("Unknown billing action");
  })(request);
