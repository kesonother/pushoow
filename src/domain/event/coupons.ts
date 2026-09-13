import { ValidationError } from "@/domain/errors";
import type { Coupon } from "@/domain/event/commerce-types";

export function applyCoupon(
  coupon: Coupon,
  eventId: string,
  amountCents: number,
  now: Date,
): { discountCents: number } {
  if (coupon.eventId && coupon.eventId !== eventId) {
    throw new ValidationError("This coupon cannot be used on this event");
  }
  if (coupon.startsAt && now < coupon.startsAt) {
    throw new ValidationError("This coupon is not active yet");
  }
  if (coupon.endsAt && now > coupon.endsAt) {
    throw new ValidationError("This coupon has expired");
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new ValidationError("This coupon has reached its usage limit");
  }
  if (coupon.kind === "percentage") {
    if (coupon.amount < 1 || coupon.amount > 100) {
      throw new ValidationError("Percentage coupons must be between 1 and 100");
    }
    return { discountCents: Math.floor((amountCents * coupon.amount) / 100) };
  }
  if (coupon.amount < 1) {
    throw new ValidationError("Fixed coupons must be a positive amount");
  }
  return { discountCents: Math.min(amountCents, coupon.amount) };
}

export function isPresale(tickets: Array<{ salesStart: Date | null }>, now: Date): boolean {
  const dated = tickets.filter((ticket) => ticket.salesStart);
  if (dated.length === 0) return false;
  return dated.every((ticket) => ticket.salesStart! > now);
}
