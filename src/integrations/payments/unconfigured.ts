import {
  PaymentNotConfiguredError,
  type PaymentAdapter,
} from "@/domain/calendar/membership-types";
import type { StripeConnectPort } from "@/domain/payments/types";

export const unconfiguredPaymentAdapter: PaymentAdapter = {
  isConfigured: () => false,
  async createCheckout() {
    throw new PaymentNotConfiguredError();
  },
  async refund() {
    throw new PaymentNotConfiguredError();
  },
};

export const unconfiguredStripeConnect: StripeConnectPort & PaymentAdapter = {
  isConfigured: () => false,
  async createExpressAccount() {
    throw new PaymentNotConfiguredError();
  },
  async createAccountLink() {
    throw new PaymentNotConfiguredError();
  },
  async retrieveAccount() {
    throw new PaymentNotConfiguredError();
  },
  async createCheckout() {
    throw new PaymentNotConfiguredError();
  },
  async refund() {
    throw new PaymentNotConfiguredError();
  },
  verifyWebhook() {
    throw new PaymentNotConfiguredError();
  },
};
