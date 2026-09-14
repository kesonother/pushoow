import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { IntegrationCredentials } from "@/domain/integration/types";

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(`pushoow.integration:${secret}`).digest();
}

export function encryptCredentials(credentials: IntegrationCredentials, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptCredentials(ciphertext: string, secret: string): IntegrationCredentials {
  if (!ciphertext) return {};
  const blob = Buffer.from(ciphertext, "base64");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const encrypted = blob.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return JSON.parse(json) as IntegrationCredentials;
}

export function hasStoredSecret(credentials: IntegrationCredentials): boolean {
  return Boolean(
    credentials.accessToken || credentials.apiKey || credentials.webhookUrl || credentials.refreshToken,
  );
}
