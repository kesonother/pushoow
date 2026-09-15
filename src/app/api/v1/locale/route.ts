import { jsonOk, readJson, withApi } from "@/api/handler";
import { ValidationError } from "@/domain/errors";
import { isLocale, localeCookieHeader } from "@/i18n/config";

export const POST = withApi(
  async ({ request, requestId }) => {
    const body = await readJson<{ locale?: string }>(request);
    if (!isLocale(body.locale)) {
      throw new ValidationError("Unsupported locale");
    }
    const response = jsonOk({ locale: body.locale }, { requestId });
    response.headers.append("Set-Cookie", localeCookieHeader(body.locale));
    return response;
  },
  { auth: "none" },
);
