import Stripe from "stripe";
import { PaymentNotConfiguredError, type PaymentAdapter } from "@/domain/calendar/membership-types";
import { ValidationError } from "@/domain/errors";
import type { StripeConnectPort } from "@/domain/payments/types";

const STRIPE_REFUND_REASONS = new Set(["duplicate", "fraudulent", "requested_by_customer"]);

export function createStripeConnectAdapter(input: {
  secretKey?: string;
  webhookSecret?: string;
}): StripeConnectPort & PaymentAdapter {
  const configured = Boolean(input.secretKey);

  function client() {
    if (!input.secretKey) throw new PaymentNotConfiguredError();
    return new Stripe(input.secretKey);
  }

  return {
    isConfigured: () => configured,
    async createExpressAccount({ organizationId, email }) {
      const account = await client().accounts.create({
        type: "express",
        email,
        metadata: { organizationId },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      return { stripeAccountId: account.id };
    },
    async createAccountLink({ stripeAccountId, refreshUrl, returnUrl }) {
      const link = await client().accountLinks.create({
        account: stripeAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });
      return { url: link.url };
    },
    async retrieveAccount(stripeAccountId) {
      const account = await client().accounts.retrieve(stripeAccountId);
      return {
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        detailsSubmitted: Boolean(account.details_submitted),
      };
    },
    async createCheckout(input) {
      if (!configured) throw new PaymentNotConfiguredError();
      const orderId =
        "orderId" in input && input.orderId
          ? input.orderId
          : ((input as { membershipId?: string }).membershipId ?? "");
      const lineItems =
        input.lineItems && input.lineItems.length > 0
          ? input.lineItems.map((item) => ({
              quantity: item.quantity,
              price_data: {
                currency: input.currency.toLowerCase(),
                unit_amount: item.unitAmountCents,
                product_data: { name: item.name },
              },
            }))
          : [
              {
                quantity: 1,
                price_data: {
                  currency: input.currency.toLowerCase(),
                  unit_amount: input.amountCents,
                  product_data: { name: "Order" },
                },
              },
            ];
      const connectedAccountId = input.connectedAccountId;
      const applicationFeeCents = input.applicationFeeCents ?? 0;
      const session = await client().checkout.sessions.create(
        {
          mode: "payment",
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          client_reference_id: orderId,
          metadata: input.metadata,
          line_items: lineItems,
          automatic_tax: input.automaticTax ? { enabled: true } : undefined,
          payment_method_options: input.require3ds
            ? { card: { request_three_d_secure: "any" } }
            : undefined,
          payment_intent_data: {
            metadata: { orderId, ...input.metadata },
            ...(connectedAccountId
              ? {
                  application_fee_amount: applicationFeeCents,
                  transfer_data: { destination: connectedAccountId },
                }
              : {}),
          },
        },
        { idempotencyKey: input.idempotencyKey ?? `checkout:${orderId}` },
      );
      if (!session.url) throw new ValidationError("Stripe did not return a checkout URL");
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      return { checkoutUrl: session.url, externalId: session.id, paymentIntentId };
    },
    async refund(input) {
      const paymentIntentId =
        "paymentIntentId" in input && input.paymentIntentId
          ? input.paymentIntentId
          : await resolvePaymentIntent(client(), (input as { externalId?: string }).externalId ?? "");
      const reason = input.reason && STRIPE_REFUND_REASONS.has(input.reason) ? input.reason : undefined;
      const refund = await client().refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: input.amountCents,
          reason: reason as Stripe.RefundCreateParams.Reason | undefined,
          metadata: input.reason ? { refund_reason: input.reason } : undefined,
        },
        { idempotencyKey: input.idempotencyKey ?? `refund:${paymentIntentId}:${input.amountCents ?? "full"}` },
      );
      return { refundId: refund.id };
    },
    verifyWebhook(payload, signature) {
      if (!input.webhookSecret) throw new PaymentNotConfiguredError();
      const event = client().webhooks.constructEvent(payload, signature, input.webhookSecret);
      return {
        id: event.id,
        type: event.type,
        data: event.data as unknown as Record<string, unknown>,
      };
    },
  };
}

async function resolvePaymentIntent(stripe: Stripe, externalId: string) {
  if (externalId.startsWith("pi_")) return externalId;
  const session = await stripe.checkout.sessions.retrieve(externalId);
  const paymentIntent = session.payment_intent;
  if (typeof paymentIntent === "string") return paymentIntent;
  if (paymentIntent?.id) return paymentIntent.id;
  throw new ValidationError("No payment intent is attached to this checkout session");
}
