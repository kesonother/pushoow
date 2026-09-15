export const LIFECYCLE_EMAILS = [
  "welcome_day0",
  "welcome_create_calendar",
  "welcome_first_event",
  "reengagement_inactive",
  "feature_education",
  "product_newsletter_optin",
] as const;

export type LifecycleEmailKey = (typeof LIFECYCLE_EMAILS)[number];

export type LifecycleMessage = {
  key: LifecycleEmailKey;
  delayMs: number;
  kind: "welcome" | "reengagement" | "feature_education" | "newsletter_opt_in";
  skipWhen?: "calendar_created" | "event_created" | "event_published" | "first_rsvp" | "first_follow";
};

export const LIFECYCLE_SERIES: LifecycleMessage[] = [
  { key: "welcome_day0", delayMs: 0, kind: "welcome" },
  {
    key: "welcome_create_calendar",
    delayMs: 2 * 86_400_000,
    kind: "welcome",
    skipWhen: "calendar_created",
  },
  {
    key: "welcome_first_event",
    delayMs: 5 * 86_400_000,
    kind: "welcome",
    skipWhen: "event_created",
  },
  {
    key: "product_newsletter_optin",
    delayMs: 3 * 86_400_000,
    kind: "newsletter_opt_in",
  },
  {
    key: "feature_education",
    delayMs: 10 * 86_400_000,
    kind: "feature_education",
  },
  {
    key: "reengagement_inactive",
    delayMs: 21 * 86_400_000,
    kind: "reengagement",
    skipWhen: "event_published",
  },
];
