import { UnauthorizedError } from "@/domain/errors";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { randomToken, sha256 } from "@/lib/token-crypto";
import type {
  RefreshTokenRecord,
  RefreshTokenRepository,
  TokenPair,
  TokenSigner,
} from "@/domain/session/types";

export type TokenServiceDeps = {
  tokens: RefreshTokenRepository;
  signer: TokenSigner;
  clock?: Clock;
  ids?: IdGenerator;
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
};

export function createTokenService(deps: TokenServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;
  const accessTtl = deps.accessTtlSeconds ?? 15 * 60;
  const refreshTtl = deps.refreshTtlSeconds ?? 30 * 24 * 60 * 60;

  function issueAccess(userId: string, familyId: string, now: Date) {
    const expiresAt = new Date(now.getTime() + accessTtl * 1000);
    const accessToken = deps.signer.sign({
      sub: userId,
      fam: familyId,
      jti: ids.id(),
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
    });
    return { accessToken, accessTokenExpiresAt: expiresAt };
  }

  async function persistRefresh(
    userId: string,
    familyId: string,
    now: Date,
  ): Promise<{ record: RefreshTokenRecord; refreshToken: string }> {
    const refreshToken = randomToken();
    const expiresAt = new Date(now.getTime() + refreshTtl * 1000);
    const record = await deps.tokens.create({
      id: ids.id(),
      userId,
      familyId,
      tokenHash: sha256(refreshToken),
      expiresAt,
      consumedAt: null,
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: now,
      updatedAt: now,
    });
    return { record, refreshToken };
  }

  async function issue(userId: string): Promise<TokenPair> {
    const now = clock.now();
    const familyId = ids.id();
    const access = issueAccess(userId, familyId, now);
    const refresh = await persistRefresh(userId, familyId, now);
    return {
      ...access,
      refreshToken: refresh.refreshToken,
      refreshTokenExpiresAt: refresh.record.expiresAt,
      familyId,
    };
  }

  async function assertFamilyActive(familyId: string) {
    const family = await deps.tokens.listByFamily(familyId);
    if (family.length === 0) {
      throw new UnauthorizedError("Session has been revoked");
    }
    if (family.every((token) => token.revokedAt)) {
      throw new UnauthorizedError("Session has been revoked");
    }
  }

  async function verifyAccessToken(accessToken: string) {
    const claims = deps.signer.verify(accessToken);
    const now = Math.floor(clock.now().getTime() / 1000);
    if (claims.exp <= now) {
      throw new UnauthorizedError("Access token expired");
    }
    await assertFamilyActive(claims.fam);
    return claims;
  }

  async function refresh(presentedToken: string): Promise<TokenPair> {
    const now = clock.now();
    const current = await deps.tokens.findByHash(sha256(presentedToken));
    if (!current || current.expiresAt <= now) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (current.revokedAt || current.consumedAt || current.replacedByTokenId) {
      await deps.tokens.revokeFamily(current.familyId, now);
      throw new UnauthorizedError("Refresh token replay detected");
    }

    const next = await persistRefresh(current.userId, current.familyId, now);
    await deps.tokens.save({
      ...current,
      consumedAt: now,
      replacedByTokenId: next.record.id,
      updatedAt: now,
    });

    const access = issueAccess(current.userId, current.familyId, now);
    return {
      ...access,
      refreshToken: next.refreshToken,
      refreshTokenExpiresAt: next.record.expiresAt,
      familyId: current.familyId,
    };
  }

  async function revokePresented(refreshToken: string) {
    const current = await deps.tokens.findByHash(sha256(refreshToken));
    if (current) {
      await deps.tokens.revokeFamily(current.familyId, clock.now());
    }
  }

  async function revokeFamily(familyId: string) {
    await deps.tokens.revokeFamily(familyId, clock.now());
  }

  async function revokeAll(userId: string) {
    await deps.tokens.revokeAllForUser(userId, clock.now());
  }

  return {
    issue,
    refresh,
    verifyAccessToken,
    revokePresented,
    revokeFamily,
    revokeAll,
  };
}
