import { getI18n } from "@/i18n/server";
import { SiteHeader } from "@/ui/site-header";
import { OpenApiExplorer } from "@/ui/openapi-explorer";

export default async function PublicApiDocsPage() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn={false} />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.developers.docsTitle}</h1>
        <p className="text-sm text-zinc-600">{t.developers.docsHint}</p>
        <OpenApiExplorer specUrl="/v1/openapi.json" />
      </main>
    </div>
  );
}
