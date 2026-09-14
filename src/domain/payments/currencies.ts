import { ValidationError } from "@/domain/errors";

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
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const ZERO_DECIMAL = new Set<SupportedCurrency>(["JPY"]);

export function normalizeCurrency(value: string): SupportedCurrency {
  const currency = value.trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency)) {
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
  return ZERO_DECIMAL.has(normalizeCurrency(currency));
}

export function formatMoney(amountCents: number, currency: string): string {
  const code = normalizeCurrency(currency);
  const major = isZeroDecimalCurrency(code) ? amountCents : amountCents / 100;
  return new Intl.NumberFormat("en", { style: "currency", currency: code }).format(major);
}
