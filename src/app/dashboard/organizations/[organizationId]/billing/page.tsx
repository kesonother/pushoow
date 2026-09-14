import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { DomainError } from "@/domain/errors";
import { formatMoney } from "@/domain/payments/currencies";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { BillingPanel } from "@/ui/billing-panel";
import { Card } from "@/ui/card";
import { InvoiceRefundButton } from "@/ui/invoice-refund-button";
import { OrgNav } from "@/ui/org-nav";
import { SiteHeader } from "@/ui/site-header";

export default async function OrganizationBillingPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let actor;
  let overview;
  try {
    actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    overview = await services.billing.overview(actor);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.dashboard.billingTitle}</h1>
        <OrgNav organizationId={organizationId} actor={actor} labels={t.dashboard} />
        <Card>
          <p className="text-sm text-amber-800">{t.dashboard.billingPendingGrid}</p>
        </Card>
        <Card>
          <p className="mb-4 text-sm text-zinc-600">
            {t.dashboard.billingCurrent}: {overview.subscription.planId} · {t.dashboard.billingStatus}:{" "}
            {overview.subscription.status}
            {overview.subscription.pendingPlanId ? ` · ${overview.subscription.pendingPlanId}` : ""}
          </p>
          <p className="mb-6 text-sm text-zinc-600">
            {t.dashboard.billingPeriod}: {overview.subscription.currentPeriodStart.toISOString().slice(0, 10)} →{" "}
            {overview.subscription.currentPeriodEnd.toISOString().slice(0, 10)}
          </p>
          <BillingPanel
            organizationId={organizationId}
            currentPlanId={overview.subscription.planId}
            pendingPlanId={overview.subscription.pendingPlanId}
            cancelAtPeriodEnd={overview.subscription.cancelAtPeriodEnd}
            catalog={overview.catalog}
            labels={{
              quote: t.dashboard.billingQuote,
              price: t.dashboard.billingPrice,
              taxes: t.dashboard.billingTaxes,
              platformFees: t.dashboard.billingPlatformFees,
              addOns: t.dashboard.billingAddOns,
              total: t.dashboard.billingTotal,
              upgrade: t.dashboard.billingUpgrade,
              downgrade: t.dashboard.billingDowngrade,
              cancel: t.dashboard.billingCancel,
              cancelConfirm: t.dashboard.billingCancelConfirm,
              cancelHint: t.dashboard.billingCancelHint,
              custom: t.dashboard.billingCustom,
              unspecified: t.dashboard.billingUnspecified,
            }}
          />
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t.dashboard.billingInvoices}</h2>
          {overview.invoices.length === 0 ? (
            <p className="text-sm text-zinc-600">—</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {overview.invoices.map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {invoice.number} · {invoice.status} · {formatMoney(invoice.totalCents, invoice.currency)}
                  </span>
                  {invoice.status === "paid" ? (
                    <InvoiceRefundButton
                      organizationId={organizationId}
                      invoiceId={invoice.id}
                      label={t.dashboard.billingRefund}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
