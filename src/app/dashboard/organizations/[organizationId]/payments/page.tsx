import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { DomainError } from "@/domain/errors";
import { formatMoney } from "@/domain/payments/currencies";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";
import { StripeConnectCard } from "@/ui/stripe-connect-card";

export default async function OrganizationPaymentsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId } = await params;
  const { t, locale } = await getI18n();
  const services = getServices();
  let account;
  let report;
  try {
    const actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    account = await services.payments.getConnect(actor);
    report = await services.payments.report(actor);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.dashboard.paymentsTitle}</h1>
        <Card>
          <StripeConnectCard
            organizationId={organizationId}
            account={account}
            labels={{
              title: t.dashboard.paymentsConnect,
              start: t.dashboard.paymentsOnboard,
              kyc: t.dashboard.paymentsKyc,
              payouts: t.dashboard.paymentsPayouts,
              charges: t.dashboard.paymentsCharges,
            }}
          />
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t.dashboard.paymentsReport}</h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>{t.event.total}</dt>
              <dd>{formatMoney(report.capturedCents, "EUR", locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t.dashboard.paymentsRefunded}</dt>
              <dd>{formatMoney(report.refundedCents, "EUR", locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t.event.tax}</dt>
              <dd>{formatMoney(report.taxCents, "EUR", locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t.event.platformFee}</dt>
              <dd>{formatMoney(report.platformFeeCents, "EUR", locale)}</dd>
            </div>
          </dl>
        </Card>
      </main>
    </div>
  );
}
