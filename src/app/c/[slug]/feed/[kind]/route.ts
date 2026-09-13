import type { FeedKind } from "@/domain/calendar/feeds";
import { DomainError } from "@/domain/errors";
import { getEnv } from "@/lib/env";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ slug: string; kind: string }>;
};

const KINDS: Record<string, FeedKind | "webcal"> = {
  "feed.ics": "ics",
  ics: "ics",
  "feed.rss": "rss",
  rss: "rss",
  "feed.atom": "atom",
  atom: "atom",
  "feed.webcal": "webcal",
  webcal: "webcal",
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, kind: rawKind } = await context.params;
    const mapped = KINDS[rawKind];
    if (!mapped) {
      return new Response("Feed not found", { status: 404 });
    }

    const url = new URL(request.url);
    const origin = getEnv().APP_URL ?? `${url.protocol}//${url.host}`;
    const token = url.searchParams.get("token");

    if (mapped === "webcal") {
      const target = new URL(`/c/${slug}/feed/ics`, origin);
      if (token) target.searchParams.set("token", token);
      return Response.redirect(`webcal://${target.host}${target.pathname}${target.search}`, 302);
    }

    const feed = await getServices().feeds.render(slug, mapped, origin, token);
    return new Response(feed.body, {
      headers: {
        "content-type": feed.contentType,
        "cache-control": "public, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return new Response(error.message, { status: error.status });
    }
    throw error;
  }
}
