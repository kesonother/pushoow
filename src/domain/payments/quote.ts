import { assertSameCurrency, type SupportedCurrency } from "@/domain/payments/currencies";
import { DEFAULT_PLATFORM_FEE_BPS, platformFeeCents } from "@/domain/payments/fees";

export type QuoteLine = {
  kind: "ticket" | "addon" | "discount" | "tax" | "platform_fee";
  label: string;
  amountCents: number;
};

export type PaymentQuote = {
  currency: SupportedCurrency;
  ticketSubtotalCents: number;
  addOnSubtotalCents: number;
  discountCents: number;
  taxCents: number;
  platformFeeCents: number;
  platformFeeBps: number;
  merchandiseCents: number;
  totalCents: number;
  organizerPayoutCents: number;
  taxConfigured: boolean;
  lines: QuoteLine[];
};

export function quotePayment(input: {
  tickets: Array<{ name: string; quantity: number; unitPriceCents: number; currency: string }>;
  addOns?: Array<{ name: string; quantity?: number; unitPriceCents: number; currency: string }>;
  discountCents?: number;
  taxCents?: number;
  taxConfigured?: boolean;
  platformFeeBps?: number;
}): PaymentQuote {
  const currencies = [
    ...input.tickets.map((item) => item.currency),
    ...(input.addOns ?? []).map((item) => item.currency),
  ];
  const currency = assertSameCurrency(currencies);
  const ticketSubtotalCents = input.tickets.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  );
  const addOnSubtotalCents = (input.addOns ?? []).reduce(
    (sum, item) => sum + item.unitPriceCents * (item.quantity ?? 1),
    0,
  );
  const discountCents = Math.min(input.discountCents ?? 0, ticketSubtotalCents + addOnSubtotalCents);
  const merchandiseCents = Math.max(0, ticketSubtotalCents + addOnSubtotalCents - discountCents);
  const taxCents = Math.max(0, input.taxCents ?? 0);
  const feeBps = input.platformFeeBps ?? DEFAULT_PLATFORM_FEE_BPS;
  const fee = platformFeeCents(merchandiseCents, feeBps);
  const totalCents = merchandiseCents + taxCents + fee;
  const lines: QuoteLine[] = [
    ...input.tickets.map((item) => ({
      kind: "ticket" as const,
      label: `${item.name} × ${item.quantity}`,
      amountCents: item.unitPriceCents * item.quantity,
    })),
    ...(input.addOns ?? []).map((item) => ({
      kind: "addon" as const,
      label: item.name,
      amountCents: item.unitPriceCents * (item.quantity ?? 1),
    })),
  ];
  if (discountCents > 0) {
    lines.push({ kind: "discount", label: "Discount", amountCents: -discountCents });
  }
  lines.push({
    kind: "tax",
    label: input.taxConfigured ? "Tax" : "Tax (Stripe Tax not configured)",
    amountCents: taxCents,
  });
  lines.push({
    kind: "platform_fee",
    label: `Platform fee (${(feeBps / 100).toFixed(2)}%)`,
    amountCents: fee,
  });
  return {
    currency,
    ticketSubtotalCents,
    addOnSubtotalCents,
    discountCents,
    taxCents,
    platformFeeCents: fee,
    platformFeeBps: feeBps,
    merchandiseCents,
    totalCents,
    organizerPayoutCents: merchandiseCents,
    taxConfigured: Boolean(input.taxConfigured),
    lines,
  };
}
