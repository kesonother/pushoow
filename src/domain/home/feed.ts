import { publicDiscoveryCard } from "@/api/discovery-view";
import type { FeaturedCalendarCard } from "@/domain/discovery/types";
import { intlLocaleFor } from "@/i18n/config";
import { getServices } from "@/server/container";

export type HomeEventPreview = {
  id: string;
  href: string;
  title: string;
  meta: string;
  imageUrl: string;
  imageAlt: string;
};

export type HomeCommunityPreview = {
  id: string;
  href: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string;
};

export type HomeFeed = {
  city: string;
  popular: HomeEventPreview[];
  upcoming: HomeEventPreview[];
  communities: HomeCommunityPreview[];
};

const COVER_IMAGES = [
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=400&h=400&q=80",
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=400&h=400&q=80",
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=400&h=400&q=80",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=400&h=400&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=400&h=400&q=80",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&h=400&q=80",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=400&h=400&q=80",
  "https://images.unsplash.com/photo-1521737711867-e3b973dceda4?auto=format&fit=crop&w=400&h=400&q=80",
];

const COMMUNITY_IMAGES = [
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=96&h=96&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=96&h=96&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=96&h=96&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=96&h=96&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=96&h=96&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=96&h=96&q=80",
];

type PublicEventView = ReturnType<typeof publicDiscoveryCard>;

function atHour(daysFromNow: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function formatCompactMeta(date: Date, locale: string, timeZone: string, city?: string | null): string {
  try {
    const when = new Intl.DateTimeFormat(intlLocaleFor(locale), {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(date);
    return city ? `${when} · ${city}` : when;
  } catch {
    return new Intl.DateTimeFormat(intlLocaleFor(locale), {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
}

function coverFor(index: number, coverImageUrl?: string | null): string {
  if (coverImageUrl) return coverImageUrl;
  return COVER_IMAGES[index % COVER_IMAGES.length]!;
}

export function padItems<T extends { id: string }>(items: T[], fallback: T[], count: number): T[] {
  const seen = new Set(items.map((item) => item.id));
  const extra = fallback.filter((item) => !seen.has(item.id));
  return [...items, ...extra].slice(0, count);
}

export function dummyEvents(locale: string): HomeEventPreview[] {
  const items = [
    { title: "China at Full Speed, Is Europe Ready?", days: 1, hour: 16, image: 0 },
    { title: "Codex Community Meetup — Paris", days: 1, hour: 18, image: 1 },
    { title: "Physical AI Paris Meetup #3", days: 2, hour: 19, image: 2 },
    { title: "Back to Build Party for founders", days: 3, hour: 19, image: 3 },
    { title: "Closing dotAI with H Company", days: 4, hour: 19, image: 4 },
    { title: "6e Édition exceptionnelle : Les Apéros de l’IA", days: 5, hour: 19, image: 5 },
    { title: "Tech Week Grand Opening", days: 8, hour: 18, image: 6 },
    { title: "New York Climate Summit preview", days: 12, hour: 17, image: 7 },
    { title: "Chihuahua Tech Week salon", days: 16, hour: 10, image: 0 },
    { title: "San Francisco Tech mixer", days: 20, hour: 18, image: 1 },
  ];
  return items.map((item, index) => {
    const startsAt = atHour(item.days, item.hour);
    return {
      id: `demo-event-${index + 1}`,
      href: `/discover?q=${encodeURIComponent(item.title)}`,
      title: item.title,
      meta: formatCompactMeta(startsAt, locale, "Europe/Paris"),
      imageUrl: coverFor(item.image),
      imageAlt: item.title,
    };
  });
}

export function dummyCommunities(): HomeCommunityPreview[] {
  return [
    {
      id: "demo-reading",
      href: "/calendars",
      name: "Reading Rhythms Global",
      description: "Part book club, part listening party. Read with friends in a living room.",
      imageUrl: COMMUNITY_IMAGES[0]!,
      imageAlt: "Reading Rhythms Global",
    },
    {
      id: "demo-build",
      href: "/calendars",
      name: "Build Club",
      description: "The most collaborative AI community in the world. 30k builders shipping together.",
      imageUrl: COMMUNITY_IMAGES[1]!,
      imageAlt: "Build Club",
    },
    {
      id: "demo-spc",
      href: "/calendars",
      name: "South Park Commons",
      description: "A home for curious people between 1 and 2: before the idea, after the leap.",
      imageUrl: COMMUNITY_IMAGES[2]!,
      imageAlt: "South Park Commons",
    },
    {
      id: "demo-design",
      href: "/calendars",
      name: "Design Buddies",
      description: "Events for all creatives across SF, LA, online, and the world.",
      imageUrl: COMMUNITY_IMAGES[3]!,
      imageAlt: "Design Buddies",
    },
    {
      id: "demo-indie",
      href: "/calendars",
      name: "Indie Hackers Paris",
      description: "Founders sharing revenue, shipping logs, and late-night build sessions.",
      imageUrl: COMMUNITY_IMAGES[4]!,
      imageAlt: "Indie Hackers Paris",
    },
    {
      id: "demo-deeptech",
      href: "/calendars",
      name: "DeepTech Founders",
      description: "Researchers and operators turning lab work into public community events.",
      imageUrl: COMMUNITY_IMAGES[5]!,
      imageAlt: "DeepTech Founders",
    },
  ];
}

function fromPublicEvent(card: PublicEventView, locale: string, index: number): HomeEventPreview {
  const startsAt = new Date(card.event.startsAt);
  return {
    id: card.event.id,
    href: `/e/${card.event.slug}`,
    title: card.event.title,
    meta: formatCompactMeta(startsAt, locale, card.event.timezone, card.event.city),
    imageUrl: coverFor(index, card.event.coverImageUrl),
    imageAlt: card.event.title,
  };
}

function fromFeaturedCalendar(calendar: FeaturedCalendarCard, index: number): HomeCommunityPreview {
  return {
    id: calendar.id,
    href: `/c/${calendar.slug}`,
    name: calendar.name,
    description: calendar.description?.trim() || calendar.tags.slice(0, 3).join(" · ") || calendar.name,
    imageUrl: COMMUNITY_IMAGES[index % COMMUNITY_IMAGES.length]!,
    imageAlt: calendar.name,
  };
}

export function buildHomeFeed(input: {
  locale: string;
  defaultCity: string;
  popular: PublicEventView[];
  upcoming: PublicEventView[];
  communities: FeaturedCalendarCard[];
}): HomeFeed {
  const fallbackEvents = dummyEvents(input.locale);
  const fallbackCommunities = dummyCommunities();
  const city = input.popular.find((card) => card.event.city)?.event.city ?? input.defaultCity;
  return {
    city,
    popular: padItems(
      input.popular.map((card, index) => fromPublicEvent(card, input.locale, index)),
      fallbackEvents,
      6,
    ),
    upcoming: padItems(
      input.upcoming.map((card, index) => fromPublicEvent(card, input.locale, index + 6)),
      fallbackEvents.slice(6),
      4,
    ),
    communities: padItems(input.communities.map(fromFeaturedCalendar), fallbackCommunities, 6),
  };
}

export async function loadHomeFeed(locale: string, defaultCity: string): Promise<HomeFeed> {
  try {
    const discovery = getServices().discovery;
    const [sections, featured] = await Promise.all([discovery.sections(), discovery.featuredCalendars()]);
    return buildHomeFeed({
      locale,
      defaultCity,
      popular: sections.trending.map(publicDiscoveryCard),
      upcoming: (sections.closingSoon.length > 0 ? sections.closingSoon : sections.editorsPicks).map(
        publicDiscoveryCard,
      ),
      communities: featured,
    });
  } catch {
    const events = dummyEvents(locale);
    return {
      city: defaultCity,
      popular: events.slice(0, 6),
      upcoming: events.slice(6, 10),
      communities: dummyCommunities(),
    };
  }
}
