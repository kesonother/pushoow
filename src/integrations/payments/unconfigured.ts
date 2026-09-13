import {
  PaymentNotConfiguredError,
  type PaymentAdapter,
} from "@/domain/calendar/membership-types";

export const unconfiguredPaymentAdapter: PaymentAdapter = {
  isConfigured: () => false,
  async createCheckout() {
    throw new PaymentNotConfiguredError();
  },
  async refund() {
    throw new PaymentNotConfiguredError();
  },
};
