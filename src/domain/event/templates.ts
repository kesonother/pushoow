export const EVENT_TEMPLATE_IDS = [
  "first_meetup",
  "meetup",
  "dinner",
  "conference",
  "workshop",
  "hackathon",
  "demo_night",
  "run_club",
  "yoga",
  "online_class",
] as const;

export type EventTemplateId = (typeof EVENT_TEMPLATE_IDS)[number];

export type EventTemplate = {
  id: string;
  name: string;
  description: string;
  defaults: {
    durationMinutes: number;
    locationKind: "physical" | "virtual" | "hybrid";
    tags: string[];
    capacity: number | null;
    registrationMode: "open_rsvp" | "approval";
    waitlistEnabled: boolean;
  };
};

const TEMPLATES: EventTemplate[] = [
  {
    id: "first_meetup",
    name: "First Meetup",
    description: "Starter meetup to publish and share",
    defaults: {
      durationMinutes: 120,
      locationKind: "physical",
      tags: ["meetup", "first"],
      capacity: 80,
      registrationMode: "open_rsvp",
      waitlistEnabled: true,
    },
  },
  {
    id: "meetup",
    name: "Meetup",
    description: "Casual community gathering",
    defaults: {
      durationMinutes: 120,
      locationKind: "physical",
      tags: ["meetup"],
      capacity: 80,
      registrationMode: "open_rsvp",
      waitlistEnabled: true,
    },
  },
  {
    id: "dinner",
    name: "Dinner",
    description: "Small hosted dinner",
    defaults: {
      durationMinutes: 150,
      locationKind: "physical",
      tags: ["dinner"],
      capacity: 12,
      registrationMode: "approval",
      waitlistEnabled: true,
    },
  },
  {
    id: "conference",
    name: "Conference",
    description: "Multi-session conference day",
    defaults: {
      durationMinutes: 480,
      locationKind: "hybrid",
      tags: ["conference"],
      capacity: 400,
      registrationMode: "open_rsvp",
      waitlistEnabled: true,
    },
  },
  {
    id: "workshop",
    name: "Workshop",
    description: "Hands-on working session",
    defaults: {
      durationMinutes: 180,
      locationKind: "physical",
      tags: ["workshop"],
      capacity: 30,
      registrationMode: "open_rsvp",
      waitlistEnabled: true,
    },
  },
  {
    id: "hackathon",
    name: "Hackathon",
    description: "Build together over a longer window",
    defaults: {
      durationMinutes: 1440,
      locationKind: "hybrid",
      tags: ["hackathon"],
      capacity: 150,
      registrationMode: "open_rsvp",
      waitlistEnabled: true,
    },
  },
  {
    id: "demo_night",
    name: "Demo night",
    description: "Short product demos",
    defaults: {
      durationMinutes: 120,
      locationKind: "physical",
      tags: ["demo"],
      capacity: 100,
      registrationMode: "open_rsvp",
      waitlistEnabled: true,
    },
  },
  {
    id: "run_club",
    name: "Run club",
    description: "Group run",
    defaults: {
      durationMinutes: 75,
      locationKind: "physical",
      tags: ["run"],
      capacity: 40,
      registrationMode: "open_rsvp",
      waitlistEnabled: false,
    },
  },
  {
    id: "yoga",
    name: "Yoga",
    description: "Guided yoga session",
    defaults: {
      durationMinutes: 60,
      locationKind: "physical",
      tags: ["yoga"],
      capacity: 20,
      registrationMode: "open_rsvp",
      waitlistEnabled: true,
    },
  },
  {
    id: "online_class",
    name: "Online class",
    description: "Virtual class",
    defaults: {
      durationMinutes: 90,
      locationKind: "virtual",
      tags: ["class", "online"],
      capacity: 50,
      registrationMode: "open_rsvp",
      waitlistEnabled: true,
    },
  },
];

const extraTemplates: EventTemplate[] = [];

export function registerEventTemplate(template: EventTemplate) {
  extraTemplates.push(template);
}

export function listEventTemplates(): EventTemplate[] {
  return [...TEMPLATES, ...extraTemplates];
}

export function getEventTemplate(id: string): EventTemplate | null {
  return listEventTemplates().find((template) => template.id === id) ?? null;
}
