import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ValidationError } from "@/domain/errors";
import { CACHE_SEAL_ALG, type SealedCache } from "@/domain/mobile/types";

export function deriveDeviceCacheKey(deviceUnlockKey: string): Buffer {
  if (deviceUnlockKey.trim().length < 16) {
    throw new ValidationError("Device unlock key must be at least 16 characters");
  }
  return createHash("sha256").update(deviceUnlockKey).digest();
}

export function sealSensitiveCache(payload: unknown, deviceUnlockKey: string): SealedCache {
  const iv = randomBytes(12);
  const key = deriveDeviceCacheKey(deviceUnlockKey);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return {
    alg: CACHE_SEAL_ALG,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: encrypted.toString("base64url"),
  };
}

export function unsealSensitiveCache<T>(sealed: SealedCache, deviceUnlockKey: string): T {
  if (sealed.alg !== CACHE_SEAL_ALG) {
    throw new ValidationError("Unsupported cache seal algorithm");
  }
  const key = deriveDeviceCacheKey(deviceUnlockKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64url"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plain.toString("utf8")) as T;
}

export function sealedContainsPlaintext(sealed: SealedCache, secret: string): boolean {
  if (!secret) return false;
  return (
    sealed.ciphertext.includes(secret) ||
    Buffer.from(sealed.ciphertext, "base64url").toString("utf8").includes(secret)
  );
}
