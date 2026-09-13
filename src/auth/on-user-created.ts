import { getDb } from "@/db/client";
import {
  createDrizzleDomainRepository,
  createDrizzleProfileRepository,
} from "@/db/repositories/identity-repo";
import { createDrizzleMembershipRepository } from "@/db/repositories/organization-repo";
import { createDomainService } from "@/domain/enterprise/domains";
import { createProfileService } from "@/domain/profile/service";
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
}
