import { ProviderNotConfiguredError } from "@/domain/notification/types";
import type { MobilePushPort } from "@/domain/mobile/types";

export function unconfiguredMobilePush(provider: MobilePushPort["provider"]): MobilePushPort {
  return {
    provider,
    isConfigured: () => false,
    async send() {
      throw new ProviderNotConfiguredError("mobile_push");
    },
  };
}
