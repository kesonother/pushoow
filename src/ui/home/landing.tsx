import { HOME_CATEGORIES } from "@/domain/home/categories";
import type { HomeFeed } from "@/domain/home/feed";
import type { Dictionary } from "@/i18n/dictionaries";
import { BottomCTA } from "@/ui/home/bottom-cta";
import {
  CategoryCard,
  CityPin,
  CommunityCard,
  PopularEventCard,
  SectionHeading,
  UpcomingEventCard,
} from "@/ui/home/cards";
import { Footer } from "@/ui/home/footer";
import { Header } from "@/ui/home/header";
import { Hero } from "@/ui/home/hero";

export function Landing({
  t,
  feed,
  signedIn,
}: {
  t: Dictionary;
  feed: HomeFeed;
  signedIn: boolean;
}) {
  const copy = t.homeLanding;

  return (
    <div className="flex min-h-full flex-col bg-white text-[#171717]">
      <Header t={t} signedIn={signedIn} />
      <main id="content" className="mx-auto flex w-full max-w-[620px] flex-1 flex-col px-6 pb-8">
        <Hero t={t} signedIn={signedIn} />

        <section className="mt-12" aria-labelledby="home-popular">
          <SectionHeading
            id="home-popular"
            action={<CityPin href="/discover" label={copy.popularCityHint} />}
          >
            {copy.popularPrefix} <span className="text-[#EA580C]">{feed.city}</span>
          </SectionHeading>
          <ul className="home-h-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-6 sm:overflow-visible sm:pb-0">
            {feed.popular.map((event) => (
              <li key={event.id}>
                <PopularEventCard event={event} />
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="home-upcoming">
          <SectionHeading id="home-upcoming">{copy.upcomingTitle}</SectionHeading>
          <ul className="home-h-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0">
            {feed.upcoming.map((event) => (
              <li key={event.id} className="flex md:min-w-0">
                <UpcomingEventCard event={event} />
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="home-communities">
          <SectionHeading id="home-communities">{copy.communitiesTitle}</SectionHeading>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {feed.communities.map((community) => (
              <li key={community.id}>
                <CommunityCard community={community} />
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="home-categories">
          <SectionHeading id="home-categories">{copy.categoriesTitle}</SectionHeading>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {HOME_CATEGORIES.map((category) => (
              <li key={category.id}>
                <CategoryCard
                  id={category.id}
                  color={category.color}
                  href={`/discover?tag=${encodeURIComponent(category.tag)}`}
                  label={copy.categories[category.id]}
                />
              </li>
            ))}
          </ul>
        </section>

        <BottomCTA t={t} signedIn={signedIn} />
      </main>
      <Footer t={t} />
    </div>
  );
}
