import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { firstMeetupPrefill } from "@/domain/onboarding/templates";
import { EventWizard } from "@/ui/event-wizard";
import { wizardLabels } from "@/ui/event-wizard-labels";
import { SiteHeader } from "@/ui/site-header";

function toLocalInput(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export default async function NewEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; calendarId: string }>;
  searchParams: Promise<{ starter?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId, calendarId } = await params;
  const query = await searchParams;
  const { t } = await getI18n();
  const services = getServices();
  let starter;
  try {
    const actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    const existing = await services.events.listEvents(actor, calendarId);
    if (query.starter === "first_meetup" || existing.length === 0) {
      const prefill = firstMeetupPrefill();
      starter = {
        title: prefill.title,
        description: prefill.description,
        startsAt: toLocalInput(prefill.startsAt),
        endsAt: toLocalInput(prefill.endsAt),
        templateId: prefill.templateId,
        tags: prefill.tags.join(", "),
        locationKind: prefill.locationKind,
        registrationMode: prefill.registrationMode,
        capacity: String(prefill.capacity),
      };
    }
  } catch (error) {
    if (error instanceof DomainError) redirect("/dashboard");
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.event.wizardTitle}</h1>
        <Card>
          <EventWizard
            organizationId={organizationId}
            calendarId={calendarId}
            labels={wizardLabels(t)}
            initial={starter}
          />
        </Card>
      </main>
    </div>
  );
}
