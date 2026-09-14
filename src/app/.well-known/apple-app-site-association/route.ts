import { withApi } from "@/api/handler";

export const GET = withApi(
  async ({ requestId }) =>
    new Response(
      JSON.stringify({
        applinks: {
          apps: [],
          details: [
            {
              appID: process.env.MOBILE_IOS_APP_ID ?? "TEAMID.com.pushoow.app",
              paths: ["/e/*", "/c/*", "/me/tickets/*"],
            },
          ],
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId,
        },
      },
    ),
  { auth: "none" },
);
