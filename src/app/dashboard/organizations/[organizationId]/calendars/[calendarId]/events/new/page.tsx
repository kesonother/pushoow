import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { EventWizard } from "@/ui/event-wizard";
import { wizardLabels } from "@/ui/event-wizard-labels";
import { SiteHeader } from "@/ui/site-header";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ organizationId: string; calendarId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId, calendarId } = await params;
  const { t } = await getI18n();
  try {
    await requireFullDashboardActor(
      getServices().access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
  } catch (error) {
    if (error instanceof DomainError) redirect("/dashboard");
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t.event.wizardTitle}</h1>
        <Card>
          <EventWizard
            organizationId={organizationId}
            calendarId={calendarId}
            labels={wizardLabels(t)}
          />
        </Card>
      </main>
    </div>
  );
}
