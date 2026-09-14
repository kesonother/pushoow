import { withApi } from "@/api/handler";

export const GET = withApi(
  async ({ requestId }) =>
    new Response(
      JSON.stringify([
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: process.env.MOBILE_ANDROID_PACKAGE ?? "com.pushoow.app",
            sha256_cert_fingerprints: process.env.MOBILE_ANDROID_SHA256
              ? [process.env.MOBILE_ANDROID_SHA256]
              : ["AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA"],
          },
        },
      ]),
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
