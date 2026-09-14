import { ValidationError } from "@/domain/errors";
import { decodeJson, encodeJson, safeEqual, signPayload } from "@/lib/token-crypto";

export type CheckInQrClaims = {
  e: string;
  r: string;
  t: string | null;
  x: number | null;
  n: string;
};

export function signCheckInQr(claims: CheckInQrClaims, secret: string): string {
  const payload = encodeJson(claims);
  return `${payload}.${signPayload(payload, secret)}`;
}

export function verifyCheckInQr(
  token: string,
  secret: string,
  now = new Date(),
): { ok: true; claims: CheckInQrClaims } | { ok: false; reason: "invalid" | "expired" } {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return { ok: false, reason: "invalid" };
  const expected = signPayload(payload, secret);
  if (!safeEqual(expected, signature)) return { ok: false, reason: "invalid" };
  try {
    const claims = decodeJson<CheckInQrClaims>(payload);
    if (!claims.e || !claims.r || !claims.n) return { ok: false, reason: "invalid" };
    if (claims.x != null && now.getTime() > claims.x) return { ok: false, reason: "expired" };
    return { ok: true, claims };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function assertCheckInQr(token: string, secret: string, now = new Date()): CheckInQrClaims {
  const verified = verifyCheckInQr(token, secret, now);
  if (!verified.ok) {
    throw new ValidationError(verified.reason === "expired" ? "This check-in QR has expired" : "Invalid check-in QR");
  }
  return verified.claims;
}
