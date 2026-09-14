import { PUBLIC_API_SCOPES, PUBLIC_API_VERSION, PUBLIC_WEBHOOK_EVENTS } from "@/domain/public-api/types";

const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message", "requestId"],
      properties: {
        code: {
          type: "string",
          enum: ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "VALIDATION", "RATE_LIMITED"],
        },
        message: { type: "string", examples: ["Authentication required"] },
        details: { type: "object", additionalProperties: true },
        requestId: { type: "string", examples: ["req_01"] },
      },
    },
  },
};

const data = (schema: Record<string, unknown>) => ({
  type: "object",
  required: ["data"],
  properties: { data: schema },
});

function path(summary: string, opts: { get?: object; post?: object; patch?: object }) {
  return { summary, ...opts };
}

function op(summary: string, opts: { security?: boolean; body?: Record<string, unknown>; response: Record<string, unknown> }) {
  return {
    summary,
    security: opts.security === false ? [] : [{ bearerAuth: [] }, { apiKey: [] }],
    requestBody: opts.body
      ? { required: true, content: { "application/json": { schema: opts.body, examples: { default: { value: opts.body } } } } }
      : undefined,
    responses: {
      "200": { description: "OK", content: { "application/json": { schema: data(opts.response) } } },
      "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
      "403": { description: "Forbidden", content: { "application/json": { schema: errorSchema } } },
      "429": { description: "Rate limited", content: { "application/json": { schema: errorSchema } } },
    },
  };
}

export function publicOpenApiDocument(appUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Pushoow Public API",
      version: PUBLIC_API_VERSION,
      summary: "Versioned public API for organizations, events, ticketing, and check-in.",
      description:
        "All public routes are versioned under /v1. Deprecated versions remain available for 12 months after announcement. Authenticate with an API key (`Authorization: Bearer pk_live_…` or `X-Api-Key`) or an OAuth 2.1 access token (authorization code + PKCE).",
    },
    servers: [{ url: `${appUrl.replace(/\/$/, "")}/v1`, description: "Public API v1" }],
    tags: [
      { name: "organizations" },
      { name: "calendars" },
      { name: "events" },
      { name: "registrations" },
      { name: "tickets" },
      { name: "attendees" },
      { name: "check-ins" },
      { name: "payments" },
      { name: "refunds" },
      { name: "webhooks" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "API key or OAuth 2.1 access token" },
        apiKey: { type: "apiKey", in: "header", name: "X-Api-Key" },
      },
      schemas: {
        Error: errorSchema,
        Organization: {
          type: "object",
          properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" } },
          examples: [{ id: "org_1", name: "Pushoow", slug: "pushoow" }],
        },
        Event: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            status: { type: "string" },
            startsAt: { type: "string", format: "date-time" },
          },
        },
        WebhookEvent: { type: "string", enum: [...PUBLIC_WEBHOOK_EVENTS] },
      },
    },
    paths: {
      "/organizations": path("Organizations", {
        get: { ...op("List organizations", { response: { type: "array", items: { $ref: "#/components/schemas/Organization" } } }), tags: ["organizations"] },
      }),
      "/organizations/{organizationId}": path("Organization", {
        get: { ...op("Get organization", { response: { $ref: "#/components/schemas/Organization" } }), tags: ["organizations"] },
      }),
      "/calendars": path("Calendars", {
        get: { ...op("List calendars", { response: { type: "array", items: { type: "object" } } }), tags: ["calendars"] },
      }),
      "/calendars/{calendarId}": path("Calendar", {
        get: { ...op("Get calendar", { response: { type: "object" } }), tags: ["calendars"] },
      }),
      "/events": path("Events", {
        get: { ...op("List events", { response: { type: "array", items: { $ref: "#/components/schemas/Event" } } }), tags: ["events"] },
        post: { ...op("Create event", { body: { type: "object" }, response: { $ref: "#/components/schemas/Event" } }), tags: ["events"] },
      }),
      "/events/{eventId}": path("Event", {
        get: { ...op("Get event", { response: { $ref: "#/components/schemas/Event" } }), tags: ["events"] },
        patch: { ...op("Update event", { body: { type: "object" }, response: { $ref: "#/components/schemas/Event" } }), tags: ["events"] },
      }),
      "/events/{eventId}/registrations": path("Registrations", {
        get: { ...op("List registrations", { response: { type: "array" } }), tags: ["registrations"] },
        post: { ...op("Create registration", { body: { type: "object" }, response: { type: "object" } }), tags: ["registrations"] },
      }),
      "/events/{eventId}/tickets": path("Tickets", {
        get: { ...op("List tickets", { response: { type: "array" } }), tags: ["tickets"] },
      }),
      "/events/{eventId}/attendees": path("Attendees", {
        get: { ...op("List attendees", { response: { type: "array" } }), tags: ["attendees"] },
      }),
      "/events/{eventId}/check-ins": path("Check-ins", {
        get: { ...op("List check-ins", { response: { type: "array" } }), tags: ["check-ins"] },
        post: { ...op("Create check-in", { body: { type: "object" }, response: { type: "object" } }), tags: ["check-ins"] },
      }),
      "/organizations/{organizationId}/payments": path("Payments", {
        get: { ...op("List payments", { response: { type: "array" } }), tags: ["payments"] },
      }),
      "/organizations/{organizationId}/refunds": path("Refunds", {
        get: { ...op("List refunds", { response: { type: "array" } }), tags: ["refunds"] },
        post: { ...op("Issue refund", { body: { type: "object" }, response: { type: "object" } }), tags: ["refunds"] },
      }),
      "/webhooks": path("Webhooks", {
        get: { ...op("List webhook endpoints", { response: { type: "array" } }), tags: ["webhooks"] },
        post: { ...op("Create webhook endpoint", { body: { type: "object" }, response: { type: "object" } }), tags: ["webhooks"] },
      }),
      "/oauth/token": path("OAuth 2.1 token", {
        post: { ...op("Exchange authorization code", { security: false, body: { type: "object" }, response: { type: "object" } }), tags: ["organizations"] },
      }),
    },
    "x-scopes": [...PUBLIC_API_SCOPES],
    "x-deprecation-policy": "12 months after a version is announced as deprecated",
  };
}
