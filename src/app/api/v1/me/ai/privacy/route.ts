import { aiPrivacyPatchSchema } from "@/api/ai-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

export const GET = withApi(async ({ user, requestId }) => {
  return jsonOk(await getServices().ai.privacySettings(user!.id), { requestId });
});

export const PATCH = withApi(async ({ user, request, requestId }) => {
  const body = aiPrivacyPatchSchema.parse(await readJson(request));
  const services = getServices();
  const data = await services.ai.updatePrivacy(user!.id, body);
  await writeAuditLog(services.db, {
    actorUserId: user!.id,
    action: "ai.privacy.update",
    resourceType: "user",
    resourceId: user!.id,
    metadata: {
      processingOptOut: data.processingOptOut,
      trainingConsent: data.trainingConsent,
      disclosureAcknowledged: data.disclosureAcknowledged,
    },
    requestId,
  });
  return jsonOk(data, { requestId });
});
