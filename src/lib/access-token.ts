import { UnauthorizedError } from "@/domain/errors";
import type { AccessTokenClaims, TokenSigner } from "@/domain/session/types";
import { decodeJson, encodeJson, safeEqual, signPayload } from "@/lib/token-crypto";

export function createHmacTokenSigner(secret: string): TokenSigner {
  return {
    sign(claims) {
      const payload = encodeJson(claims);
      return `${payload}.${signPayload(payload, secret)}`;
    },
    verify(token) {
      const [payload, signature] = token.split(".");
      if (!payload || !signature) {
        throw new UnauthorizedError("Invalid access token");
      }
      const expected = signPayload(payload, secret);
      if (!safeEqual(signature, expected)) {
        throw new UnauthorizedError("Invalid access token");
      }
      return decodeJson<AccessTokenClaims>(payload);
    },
  };
}
