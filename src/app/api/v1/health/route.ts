import { withApi, jsonOk } from "@/api/handler";

export const GET = withApi(
  async ({ requestId }) =>
    jsonOk(
      {
        status: "ok",
        service: "pushoow",
        time: new Date().toISOString(),
      },
      { requestId },
    ),
  { auth: "none" },
);
