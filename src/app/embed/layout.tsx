import { noindexMetadata } from "@/domain/seo/metadata";

export const metadata = noindexMetadata;

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
