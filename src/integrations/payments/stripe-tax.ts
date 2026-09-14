import Stripe from "stripe";
import type { TaxPort } from "@/domain/payments/types";

export function createStripeTaxPort(input: { secretKey?: string; enabled?: boolean }): TaxPort {
  const configured = Boolean(input.secretKey && input.enabled);

  return {
    isConfigured: () => configured,
    async calculate({ currency, amountCents, exemptionCode, address }) {
      if (!configured || !input.secretKey) {
        return { taxCents: 0, calculationId: null };
      }
      if (!address?.country) {
        return { taxCents: 0, calculationId: null };
      }
      const stripe = new Stripe(input.secretKey);
      const calculation = await stripe.tax.calculations.create({
        currency: currency.toLowerCase(),
        line_items: [{ amount: amountCents, reference: "merchandise" }],
        customer_details: {
          address: {
            country: address.country,
            postal_code: address.postalCode,
            line1: address.line1,
            city: address.city,
          },
          address_source: "billing",
          taxability_override: exemptionCode ? "customer_exempt" : "none",
        },
      });
      const taxCents = calculation.tax_amount_exclusive ?? calculation.tax_amount_inclusive ?? 0;
      return { taxCents, calculationId: calculation.id };
    },
  };
}
