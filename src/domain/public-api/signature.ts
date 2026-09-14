import { createHmac, timingSafeEqual } from "node:crypto";
import { ValidationError } from "@/domain/errors";
import { WEBHOOK_REPLAY_WINDOW_MS } from "@/domain/public-api/types";

export function signPublicWebhook(secret: string, timestamp: number, body: string): string {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

export function parsePublicWebhookSignature(header: string): { timestamp: number; signature: string } {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key?.trim() ?? "", rest.join("=").trim()];
    }),
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1 ?? "";
  if (!Number.isFinite(timestamp) || !signature) {
    throw new ValidationError("Invalid X-Signature header");
  }
  return { timestamp, signature };
}

export function verifyPublicWebhookSignature(input: {
  secret: string;
  header: string;
  body: string;
  now?: number;
  maxSkewMs?: number;
}): { timestamp: number } {
  const parsed = parsePublicWebhookSignature(input.header);
  const now = input.now ?? Date.now();
  const skew = input.maxSkewMs ?? WEBHOOK_REPLAY_WINDOW_MS;
  if (Math.abs(now - parsed.timestamp) > skew) {
    throw new ValidationError("Webhook timestamp is outside the replay window");
  }
  const expected = signPublicWebhook(input.secret, parsed.timestamp, input.body);
  const left = Buffer.from(expected);
  const right = Buffer.from(`t=${parsed.timestamp},v1=${parsed.signature}`);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new ValidationError("Invalid webhook signature");
  }
  return { timestamp: parsed.timestamp };
}

export function webhookBackoffMs(attempts: number): number {
  return Math.min(6 * 60 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempts - 1));
}
