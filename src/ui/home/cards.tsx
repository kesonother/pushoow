import Link from "next/link";
import type { ReactNode } from "react";
import type { HomeCategoryId } from "@/domain/home/categories";
import type { HomeCommunityPreview, HomeEventPreview } from "@/domain/home/feed";
import { CategoryIcon, MapPinIcon } from "@/ui/home/icons";

const cardHover =
  "transition-colors hover:border-zinc-300 hover:bg-[#FAFAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

export function SectionHeading({
  children,
  action,
  id,
}: {
  children: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-1.5">
      <h2 id={id} className="text-[16px] font-bold tracking-tight text-[#171717]">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function PopularEventCard({ event }: { event: HomeEventPreview }) {
  return (
    <article className="w-[92px] shrink-0 snap-start md:w-auto md:min-w-0">
      <Link href={event.href} className={`block rounded-[10px] ${cardHover}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={event.imageUrl}
          alt=""
          className="aspect-square w-full rounded-[10px] object-cover"
        />
        <h3 className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-tight text-[#171717]">
          {event.title}
        </h3>
        <p className="mt-0.5 text-[11px] font-normal text-zinc-600">{event.meta}</p>
      </Link>
    </article>
  );
}

export function UpcomingEventCard({ event }: { event: HomeEventPreview }) {
  return (
    <article className="w-full min-w-[200px] flex-1 snap-start md:min-w-0">
      <Link
        href={event.href}
        className={`flex min-h-[52px] items-center gap-2.5 rounded-lg border border-[#E8E8E8] bg-white px-2 py-2 ${cardHover}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={event.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
        <span className="min-w-0">
          <h3 className="truncate text-[13px] font-bold text-[#171717]">{event.title}</h3>
          <p className="truncate text-[11px] text-zinc-600">{event.meta}</p>
        </span>
      </Link>
    </article>
  );
}

export function CommunityCard({ community }: { community: HomeCommunityPreview }) {
  const initial = community.name.slice(0, 1).toUpperCase();
  return (
    <article>
      <Link
        href={community.href}
        className={`flex h-[100px] flex-col rounded-lg border border-[#E8E8E8] bg-white p-2.5 ${cardHover}`}
      >
        {community.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={community.imageUrl} alt="" className="h-7 w-7 rounded-md object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-xs font-bold text-zinc-700">
            {initial}
          </span>
        )}
        <h3 className="mt-1.5 truncate text-[13px] font-bold text-[#171717]">{community.name}</h3>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-600">{community.description}</p>
      </Link>
    </article>
  );
}

export function CategoryCard({
  id,
  label,
  color,
  href,
}: {
  id: HomeCategoryId;
  label: string;
  color: string;
  href: string;
}) {
  return (
    <article>
      <Link
        href={href}
        className={`flex h-[70px] flex-col justify-between rounded-lg border border-[#E8E8E8] bg-white px-2.5 py-2 ${cardHover}`}
      >
        <CategoryIcon id={id} className="h-4 w-4" style={{ color }} />
        <span className="text-[13px] font-medium text-[#171717]">{label}</span>
      </Link>
    </article>
  );
}

export function CityPin({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
      aria-label={label}
    >
      <MapPinIcon className="h-3.5 w-3.5" />
    </Link>
  );
}
