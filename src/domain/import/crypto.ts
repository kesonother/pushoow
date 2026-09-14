import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(`pushoow.import:${secret}`).digest();
}

export function encryptImportFile(plain: Buffer, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptImportFile(ciphertext: string, secret: string): Buffer {
  const blob = Buffer.from(ciphertext, "base64");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const encrypted = blob.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
