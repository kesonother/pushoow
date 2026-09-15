import { noindexMetadata } from "@/domain/seo/metadata";

export const metadata = noindexMetadata;

export default function AuthUtilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
