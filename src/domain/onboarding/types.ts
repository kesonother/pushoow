export const ACTIVATION_EVENTS = [
  "signup",
  "calendar_created",
  "event_created",
  "event_published",
  "first_rsvp",
  "first_follow",
  "first_checkin",
] as const;

export type ActivationEventName = (typeof ACTIVATION_EVENTS)[number];

export const ORGANIZER_STEPS = ["signup", "calendar_created", "event_created", "event_published", "share"] as const;
export type OrganizerStep = (typeof ORGANIZER_STEPS)[number];

export const ATTENDEE_STEPS = ["first_event", "first_follow", "first_rsvp"] as const;
export type AttendeeStep = (typeof ATTENDEE_STEPS)[number];

export type ActivationRecord = {
  userId: string;
  name: ActivationEventName | AttendeeStep | "share";
  organizationId?: string;
  occurredAt: Date;
};

export type OnboardingStepState = {
  id: string;
  complete: boolean;
  href: string;
};

export type OrganizerOnboarding = {
  role: "organizer";
  steps: OnboardingStepState[];
  next: OnboardingStepState | null;
  complete: boolean;
};

export type AttendeeOnboarding = {
  role: "attendee";
  steps: OnboardingStepState[];
  next: OnboardingStepState | null;
  complete: boolean;
};

export type ActivationSnapshot = {
  counts: Record<ActivationEventName, number>;
};
