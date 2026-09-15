import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import {
  createDrizzleDomainRepository,
  createDrizzleProfileRepository,
} from "@/db/repositories/identity-repo";
import { createDrizzleMembershipRepository } from "@/db/repositories/organization-repo";
import { createDomainService } from "@/domain/enterprise/domains";
import { createProfileService } from "@/domain/profile/service";
import { REFERRAL_COOKIE } from "@/domain/referral/types";
import { logger } from "@/lib/logger";

export async function onUserCreated(user: { id: string; email: string }) {
  const db = getDb();
  const profiles = createProfileService({
    profiles: createDrizzleProfileRepository(db),
    organizations: { shareOrganization: async () => false },
  });
  await profiles.ensureProfiles(user.id);

  const domains = createDomainService({
    domains: createDrizzleDomainRepository(db),
    members: createDrizzleMembershipRepository(db),
  });
  try {
    await domains.tryAutoJoin({ userId: user.id, email: user.email });
  } catch (error) {
    logger.warn({ err: error, userId: user.id }, "Auto-join skipped");
  }

  try {
    const { getServices } = await import("@/server/container");
    const services = getServices();
    await services.onboarding.startForNewUser({ userId: user.id, email: user.email });
    const code = (await cookies()).get(REFERRAL_COOKIE)?.value;
    if (code) {
      await services.referrals.attributeSignup({ code, userId: user.id, email: user.email });
    }
  } catch (error) {
    logger.warn({ err: error, userId: user.id }, "Onboarding welcome series skipped");
  }
}
