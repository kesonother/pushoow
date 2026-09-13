import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const POST = (request: Request) =>
  withApi(
    async ({ requestId }) => {
      const body = z.object({ registrationId: z.string() }).parse(await readJson(request));
      const registration = await getServices().registrations.acceptOffer(body.registrationId);
      return jsonOk(registration, { requestId });
    },
    { auth: "optional" },
  )(request);
