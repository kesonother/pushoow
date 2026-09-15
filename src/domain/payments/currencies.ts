import { ValidationError } from "@/domain/errors";
import { intlLocaleFor } from "@/i18n/config";

export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "SGD",
  "INR",
  "BRL",
  "MXN",
  "CHF",
  "CNY",
  "KRW",
  "HKD",
  "NZD",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "TRY",
  "ZAR",
  "AED",
  "PHP",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type CurrencyDefinition = {
  code: string;
  minorDigits: 0 | 2;
};

const ZERO_DECIMAL = new Set<string>(["JPY", "KRW", "HUF"]);

const REGISTRY = new Map<string, CurrencyDefinition>(
  SUPPORTED_CURRENCIES.map((code) => [
    code,
    { code, minorDigits: ZERO_DECIMAL.has(code) ? 0 : 2 },
  ]),
);

export function defineCurrency(definition: CurrencyDefinition): void {
  const code = definition.code.trim().toUpperCase();
  if (!code || !/^[A-Z]{3}$/.test(code)) {
    throw new ValidationError(`Invalid currency code '${definition.code}'`);
  }
  if (definition.minorDigits !== 0 && definition.minorDigits !== 2) {
    throw new ValidationError("Currency minor digits must be 0 or 2");
  }
  REGISTRY.set(code, { code, minorDigits: definition.minorDigits });
}

export function minorDigits(currency: string): 0 | 2 {
  return REGISTRY.get(normalizeCurrency(currency))?.minorDigits ?? 2;
}

export function toMinor(amount: number | bigint): bigint {
  if (typeof amount === "bigint") return amount;
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new ValidationError("Money amounts must be integer minor units");
  }
  return BigInt(amount);
}

export function addMinor(left: number | bigint, right: number | bigint): bigint {
  return toMinor(left) + toMinor(right);
}

export function subtractMinor(left: number | bigint, right: number | bigint): bigint {
  return toMinor(left) - toMinor(right);
}

export function multiplyMinor(
  amount: number | bigint,
  factor: { numerator: number | bigint; denominator: number | bigint },
): bigint {
  const numerator = toMinor(factor.numerator);
  const denominator = toMinor(factor.denominator);
  if (denominator === BigInt(0)) throw new ValidationError("Cannot divide money by zero");
  const product = toMinor(amount) * numerator;
  const half = denominator / BigInt(2);
  if (product >= BigInt(0)) return (product + half) / denominator;
  return (product - half) / denominator;
}

export function parseMajorToMinor(input: string, currency: string): bigint {
  const digits = minorDigits(currency);
  const trimmed = input.trim().replace(/^\u2212/, "-");
  const match = trimmed.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!match) throw new ValidationError(`Invalid money amount '${input}'`);
  const fraction = match[3] ?? "";
  if (fraction.length > digits) {
    throw new ValidationError(`Amount '${input}' has too many decimal places for ${currency}`);
  }
  const padded = fraction.padEnd(digits, "0");
  const combined = `${match[2] ?? "0"}${padded}`;
  const value = BigInt(combined);
  return match[1] ? -value : value;
}

export function normalizeCurrency(value: string): SupportedCurrency {
  const currency = value.trim().toUpperCase();
  if (!REGISTRY.has(currency)) {
    throw new ValidationError(`Unsupported currency '${value}'`);
  }
  return currency as SupportedCurrency;
}

export function assertSameCurrency(currencies: string[]): SupportedCurrency {
  if (currencies.length === 0) throw new ValidationError("A currency is required");
  const first = normalizeCurrency(currencies[0]!);
  for (const item of currencies) {
    if (normalizeCurrency(item) !== first) {
      throw new ValidationError("All line items must use the same currency");
    }
  }
  return first;
}

export function isZeroDecimalCurrency(currency: string): boolean {
  return minorDigits(currency) === 0;
}

export function formatMoney(amountMinor: number | bigint, currency: string, locale = "en"): string {
  const code = normalizeCurrency(currency);
  const digits = minorDigits(code);
  const minor = toMinor(amountMinor);
  const negative = minor < BigInt(0);
  const abs = negative ? -minor : minor;
  let scale = BigInt(1);
  for (let i = 0; i < digits; i += 1) scale *= BigInt(10);
  const integer = abs / scale;
  const fraction = abs % scale;
  const intl = intlLocaleFor(locale);
  const groupedInteger = new Intl.NumberFormat(intl, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(integer);
  const fractionStr = digits === 0 ? "" : fraction.toString().padStart(digits, "0");

  return new Intl.NumberFormat(intl, {
    style: "currency",
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .formatToParts(negative ? -1 : 1)
    .map((part) => {
      if (part.type === "integer" || part.type === "group") {
        return part.type === "integer" ? groupedInteger : "";
      }
      if (part.type === "fraction") return fractionStr;
      if (part.type === "decimal") return digits === 0 ? "" : part.value;
      if (part.type === "minusSign") return negative ? part.value : "";
      return part.value;
    })
    .join("");
}
