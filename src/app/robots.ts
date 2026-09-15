import type { MetadataRoute } from "next";
import { robotsDocument } from "@/domain/seo/robots";

export default function robots(): MetadataRoute.Robots {
  return robotsDocument();
}
