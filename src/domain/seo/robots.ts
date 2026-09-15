import type { MetadataRoute } from "next";
import { absoluteUrl, publicOrigin } from "@/lib/public-url";
import { NOINDEX_PATH_PREFIXES } from "./indexability";

export function robotsDocument(origin = publicOrigin()): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...NOINDEX_PATH_PREFIXES],
    },
    sitemap: absoluteUrl("/sitemap.xml", origin),
  };
}
