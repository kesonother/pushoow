import { createHmac, timingSafeEqual } from "node:crypto";
import { ValidationError } from "@/domain/errors";
import type { CaptchaChallenge, CaptchaVerifier } from "@/domain/privacy/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";

const CHALLENGE_MS = 5 * 60 * 1000;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createHmacCaptchaVerifier(deps: {
  secret: string;
  clock?: Clock;
}): CaptchaVerifier {
  const clock = deps.clock ?? systemClock;
  const used = new Set<string>();

  return {
    async issue() {
      const now = clock.now();
      const left = 3 + (now.getUTCSeconds() % 7);
      const right = 2 + (now.getUTCMinutes() % 8);
      const answer = String(left + right);
      const expiresAt = new Date(now.getTime() + CHALLENGE_MS);
      const payload = `${left}+${right}:${answer}:${expiresAt.getTime()}`;
      const id = `${Buffer.from(payload).toString("base64url")}.${sign(deps.secret, payload)}`;
      return { id, prompt: `What is ${left} + ${right}?`, expiresAt };
    },
    async verify(input) {
      if (!input.id || !input.answer.trim()) {
        throw new ValidationError("A CAPTCHA answer is required");
      }
      if (used.has(input.id)) {
        throw new ValidationError("CAPTCHA challenge already used");
      }
      const [encoded, signature] = input.id.split(".");
      if (!encoded || !signature) throw new ValidationError("Invalid CAPTCHA challenge");
      const payload = Buffer.from(encoded, "base64url").toString("utf8");
      if (!safeEqual(sign(deps.secret, payload), signature)) {
        throw new ValidationError("Invalid CAPTCHA challenge");
      }
      const [, answer, exp] = payload.split(":");
      if (!answer || !exp || Number(exp) < clock.now().getTime()) {
        throw new ValidationError("CAPTCHA challenge expired");
      }
      if (input.answer.trim() !== answer) {
        throw new ValidationError("CAPTCHA verification failed");
      }
      used.add(input.id);
    },
  };
}

export function createMemoryCaptchaVerifier(accepted?: { id: string; answer: string }): CaptchaVerifier {
  const issued = new Map<string, CaptchaChallenge & { answer: string }>();
  return {
    async issue() {
      if (accepted) {
        const challenge = {
          id: accepted.id,
          prompt: "test",
          expiresAt: new Date(Date.now() + CHALLENGE_MS),
          answer: accepted.answer,
        };
        issued.set(accepted.id, challenge);
        return challenge;
      }
      const challenge = {
        id: "challenge_test",
        prompt: "What is 2 + 2?",
        expiresAt: new Date(Date.now() + CHALLENGE_MS),
        answer: "4",
      };
      issued.set(challenge.id, challenge);
      return challenge;
    },
    async verify(input) {
      const challenge = issued.get(input.id);
      if (!challenge || input.answer.trim() !== challenge.answer) {
        throw new ValidationError("CAPTCHA verification failed");
      }
      issued.delete(input.id);
    },
  };
}
