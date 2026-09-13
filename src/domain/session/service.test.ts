import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/domain/errors";
import { createHmacTokenSigner } from "@/lib/access-token";
import { createTokenService } from "@/domain/session/service";
import type { RefreshTokenRecord, RefreshTokenRepository } from "@/domain/session/types";

function memoryTokens(): RefreshTokenRepository {
  const items = new Map<string, RefreshTokenRecord>();

  return {
    async create(token) {
      items.set(token.id, token);
      return token;
    },
    async findByHash(tokenHash) {
      return [...items.values()].find((item) => item.tokenHash === tokenHash) ?? null;
    },
    async listByFamily(familyId) {
      return [...items.values()].filter((item) => item.familyId === familyId);
    },
    async listByUser(userId) {
      return [...items.values()].filter((item) => item.userId === userId);
    },
    async save(token) {
      items.set(token.id, token);
      return token;
    },
    async revokeFamily(familyId, at) {
      for (const token of items.values()) {
        if (token.familyId === familyId) {
          items.set(token.id, { ...token, revokedAt: at, updatedAt: at });
        }
      }
    },
    async revokeAllForUser(userId, at) {
      for (const token of items.values()) {
        if (token.userId === userId) {
          items.set(token.id, { ...token, revokedAt: at, updatedAt: at });
        }
      }
    },
  };
}

function service(now = new Date("2026-09-13T18:00:00.000Z")) {
  return createTokenService({
    tokens: memoryTokens(),
    signer: createHmacTokenSigner("test-secret-for-unit-tests-only-32ch"),
    clock: { now: () => now },
    accessTtlSeconds: 60,
    refreshTtlSeconds: 3600,
  });
}

describe("token sessions", () => {
  it("issues a short access token and a refresh token", async () => {
    const tokens = service();
    const pair = await tokens.issue("user_1");
    const claims = await tokens.verifyAccessToken(pair.accessToken);
    expect(claims.sub).toBe("user_1");
    expect(pair.familyId).toBe(claims.fam);
  });

  it("rotates refresh tokens and rejects replay of the previous one", async () => {
    const tokens = service();
    const first = await tokens.issue("user_1");
    const rotated = await tokens.refresh(first.refreshToken);
    expect(rotated.refreshToken).not.toBe(first.refreshToken);
    expect((await tokens.verifyAccessToken(rotated.accessToken)).sub).toBe("user_1");

    await expect(tokens.refresh(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(tokens.verifyAccessToken(rotated.accessToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("rejects access after family revocation and global logout", async () => {
    const tokens = service();
    const pair = await tokens.issue("user_1");
    await tokens.revokeFamily(pair.familyId);
    await expect(tokens.verifyAccessToken(pair.accessToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    const second = await tokens.issue("user_1");
    await tokens.revokeAll("user_1");
    await expect(tokens.verifyAccessToken(second.accessToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(tokens.refresh(second.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
