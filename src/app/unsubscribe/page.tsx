import { Suspense } from "react";
import { getI18n } from "@/i18n/server";
import { SiteHeader } from "@/ui/site-header";
import { UnsubscribeForm } from "@/ui/unsubscribe-form";

export default async function UnsubscribePage() {
  const { t } = await getI18n();
  const copy = t.notifications;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn={false} />
      <main id="content" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.unsubscribeTitle}</h1>
        <p className="text-zinc-600">{copy.unsubscribeBody}</p>
        <Suspense fallback={<p>…</p>}>
          <UnsubscribeForm
            labels={{
              submit: copy.unsubscribe,
              success: copy.unsubscribeSuccess,
              unavailable: copy.unavailable,
            }}
          />
        </Suspense>
      </main>
    </div>
  );
}
