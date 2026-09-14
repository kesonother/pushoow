import { jsonOk, readJson, withApi } from "@/api/handler";
import { privacyActionSchema } from "@/api/privacy-schemas";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

export const GET = withApi(async ({ user, requestId }) => {
  return jsonOk(await getServices().privacy.settings(user!.id), { requestId });
});

export const POST = withApi(async ({ user, request, requestId }) => {
  const body = privacyActionSchema.parse(await readJson(request));
  const services = getServices();
  const userId = user!.id;
  if (body.action === "acknowledge") {
    const data = await services.privacy.acknowledgeDisclosure(userId);
    await writeAuditLog(services.db, {
      actorUserId: userId,
      action: "privacy.disclosure.ack",
      resourceType: "user",
      resourceId: userId,
      requestId,
    });
    return jsonOk(data, { requestId });
  }
  if (body.action === "opt_out") {
    const data = await services.privacy.optOutOfSale(userId);
    await writeAuditLog(services.db, {
      actorUserId: userId,
      action: "privacy.ccpa.opt_out",
      resourceType: "user",
      resourceId: userId,
      requestId,
    });
    return jsonOk(data, { requestId });
  }
  if (body.action === "consent") {
    const data = await services.privacy.recordConsent({
      userId,
      purpose: body.purpose ?? "marketing",
      granted: body.granted ?? false,
      source: "privacy_settings",
    });
    return jsonOk(data, { requestId });
  }
  if (body.action === "export" || body.action === "portability") {
    const data = await services.privacy.exportData(
      userId,
      userId,
      body.action === "portability" ? "portability" : "json",
    );
    await writeAuditLog(services.db, {
      actorUserId: userId,
      action: `privacy.${body.action}`,
      resourceType: "user",
      resourceId: userId,
      requestId,
    });
    return jsonOk(data, { requestId });
  }
  const data = await services.privacy.requestDeletion(userId, userId);
  await services.jobs.enqueue({
    type: "privacy.deletion.process",
    payload: { requestId: data.id },
    availableAt: data.dueAt,
    idempotencyKey: `privacy-delete:${data.id}`,
  });
  await writeAuditLog(services.db, {
    actorUserId: userId,
    action: "privacy.deletion.request",
    resourceType: "deletion_request",
    resourceId: data.id,
    requestId,
  });
  return jsonOk(data, { status: 201, requestId });
});
