import { createHash } from "node:crypto";

export function checkoutIdempotencyKey(input: {
  eventId: string;
  email: string;
  items: Array<{ ticketTypeId: string; quantity: number }>;
  addOnIds?: string[];
  couponCode?: string;
  taxExemptionCode?: string;
}): string {
  const items = [...input.items]
    .sort((left, right) => left.ticketTypeId.localeCompare(right.ticketTypeId))
    .map((item) => `${item.ticketTypeId}:${item.quantity}`)
    .join(",");
  const addOns = [...(input.addOnIds ?? [])].sort().join(",");
  const fingerprint = createHash("sha256")
    .update(`${items}|${addOns}|${input.couponCode ?? ""}|${input.taxExemptionCode ?? ""}`)
    .digest("hex")
    .slice(0, 24);
  return `checkout:${input.eventId}:${input.email}:${fingerprint}`;
}
