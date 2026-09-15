import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { PrivacySettings } from "@/ui/privacy-settings";
import { SiteHeader } from "@/ui/site-header";

export default async function PrivacyPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { t } = await getI18n();

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.privacy.title}</h1>
        <PrivacySettings
          labels={{
            title: t.privacy.title,
            disclosure: t.privacy.disclosure,
            acknowledge: t.privacy.acknowledge,
            optOut: t.privacy.optOut,
            export: t.privacy.export,
            portability: t.privacy.portability,
            delete: t.privacy.delete,
            unavailable: t.notifications.unavailable,
            aiTitle: t.privacy.aiTitle,
            aiDisclosure: t.privacy.aiDisclosure,
            aiOptOut: t.privacy.aiOptOut,
            aiTrainingConsent: t.privacy.aiTrainingConsent,
            aiAcknowledge: t.privacy.aiAcknowledge,
          }}
        />
      </main>
    </div>
  );
}
