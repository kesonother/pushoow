import { noindexMetadata } from "@/domain/seo/metadata";

export const metadata = noindexMetadata;

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
