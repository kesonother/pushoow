import { noindexMetadata } from "@/domain/seo/metadata";

export const metadata = noindexMetadata;

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
