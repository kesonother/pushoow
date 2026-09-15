import type { MetadataRoute } from "next";
import { staticSitemapEntries } from "@/domain/seo/sitemap";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const { getServices } = await import("@/server/container");
    return await getServices().seo.sitemap();
  } catch {
    return staticSitemapEntries();
  }
}
