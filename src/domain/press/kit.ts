export type PressAsset = {
  id: string;
  label: string;
  href: string;
  kind: "logo" | "screenshot" | "fact";
  description: string;
};

export type PressKit = {
  product: string;
  tagline: string;
  description: string;
  contactEmail: string;
  facts: Array<{ label: string; value: string }>;
  logos: PressAsset[];
  screenshots: PressAsset[];
};

export function pressKit(): PressKit {
  return {
    product: "Pushoow",
    tagline: "Calendar-first community events",
    description:
      "Pushoow is a calendar-first platform for tech, startup, and creator communities. Organizers publish calendars and events; attendees discover, follow, and RSVP.",
    contactEmail: "press@pushoow.com",
    facts: [
      { label: "Product", value: "Public calendars, events, RSVP, and ticketing" },
      { label: "Positioning", value: "Calendar-first, not a one-off event page" },
      { label: "Discovery", value: "Open by default for public events" },
      { label: "Privacy", value: "No invasive tracking by default, including embeds" },
      { label: "Company", value: "Independent product; press kit assets are brand-ready placeholders" },
    ],
    logos: [
      {
        id: "logo-mark",
        label: "Mark",
        href: "/press/logo-mark.svg",
        kind: "logo",
        description: "Standalone P mark on a dark field. Use on light or photographic backgrounds.",
      },
      {
        id: "logo-wordmark",
        label: "Wordmark",
        href: "/press/logo-wordmark.svg",
        kind: "logo",
        description: "Pushoow wordmark. Keep clear space equal to the height of the P.",
      },
      {
        id: "logo-lockup",
        label: "Lockup",
        href: "/press/logo-lockup.svg",
        kind: "logo",
        description: "Mark + wordmark lockup for headers and press mentions.",
      },
    ],
    screenshots: [
      {
        id: "shot-event",
        label: "Event page",
        href: "/press/screenshot-event.svg",
        kind: "screenshot",
        description: "Public event page with date, RSVP, and share.",
      },
      {
        id: "shot-calendar",
        label: "Calendar page",
        href: "/press/screenshot-calendar.svg",
        kind: "screenshot",
        description: "Public calendar with upcoming meetups.",
      },
      {
        id: "shot-discover",
        label: "Discover",
        href: "/press/screenshot-discover.svg",
        kind: "screenshot",
        description: "Open discovery of public community events.",
      },
    ],
  };
}
