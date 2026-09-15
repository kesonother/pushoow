export { createReferralService, MAX_CONVERSIONS_PER_CODE_PER_DAY } from "./service";
export { createMemoryReferralCodes, createMemoryReferralConversions } from "./memory";
export { generateReferralCode, normalizeReferralCode } from "./codes";
export { REFERRAL_COOKIE, REFERRAL_CODE_PATTERN } from "./types";
export type { ReferralCode, ReferralConversion, ReferralSnapshot } from "./types";
