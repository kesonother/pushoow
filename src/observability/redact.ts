const SENSITIVE_KEY =
  /^(password|passwd|pwd|token|accessToken|refreshToken|idToken|secret|clientSecret|client_secret|apiKey|api_key|authorization|cookie|set-cookie|ciphertext|webhookUrl|webhookSecret|privateKey|cardNumber|card|pan|cvc|cvv|expiry|exp_month|exp_year|stripeToken|paymentMethod|ssn|otp|prompt|output|userPrompt|markdown)$/i;

const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;
const SECRET_PATTERN = /\b(?:sk|rk|whsec|pk)_(?:live|test)_[A-Za-z0-9]+\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;

export const LOGGER_REDACT_PATHS = [
  "password",
  "email",
  "headers.authorization",
  "headers.cookie",
  "headers.set-cookie",
  "*.password",
  "*.passwd",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.accessToken",
  "*.refreshToken",
  "*.idToken",
  "*.clientSecret",
  "*.client_secret",
  "*.ciphertext",
  "*.webhookUrl",
  "*.webhookSecret",
  "*.privateKey",
  "*.cardNumber",
  "*.card",
  "*.pan",
  "*.cvc",
  "*.cvv",
  "*.expiry",
  "*.stripeToken",
  "*.paymentMethod",
  "prompt",
  "output",
  "*.prompt",
  "*.output",
  "*.markdown",
  "*.userPrompt",
] as const;

export function redactString(value: string): string {
  return value
    .replace(CARD_PATTERN, "[REDACTED_CARD]")
    .replace(SECRET_PATTERN, "[REDACTED_SECRET]")
    .replace(BEARER_PATTERN, "Bearer [REDACTED_TOKEN]");
}

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactValue(nested);
  }
  return output;
}

export function assertNoSecrets(value: unknown): void {
  const serialized = JSON.stringify(value);
  if (!serialized) return;
  if (CARD_PATTERN.test(serialized) || SECRET_PATTERN.test(serialized) || /Bearer\s+[A-Za-z0-9._~+/-]{8,}/i.test(serialized)) {
    throw new Error("Refusing to log secret material");
  }
}
