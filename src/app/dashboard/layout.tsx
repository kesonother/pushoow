import { noindexMetadata } from "@/domain/seo/metadata";

export const metadata = noindexMetadata;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
