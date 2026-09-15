export const LOCALES = ["en", "fr", "es", "pt", "de", "it", "ja", "zh", "ko", "hi", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";
export const SOURCE_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "pushoow_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function localeCookieHeader(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; SameSite=Lax; Max-Age=${LOCALE_COOKIE_MAX_AGE}`;
}

export const RTL_LOCALES: readonly Locale[] = ["ar"];

const LOCALE_ALIASES: Record<string, Locale> = {
  "zh-cn": "zh",
  "zh-hans": "zh",
  "zh-sg": "zh",
  "zh-tw": "zh",
  "zh-hant": "zh",
  "zh-hk": "zh",
  "pt-br": "pt",
  "pt-pt": "pt",
  "en-us": "en",
  "en-gb": "en",
  "fr-fr": "fr",
  "es-es": "es",
  "es-mx": "es",
  "es-419": "es",
  "de-de": "de",
  "it-it": "it",
  "ja-jp": "ja",
  "ko-kr": "ko",
  "hi-in": "hi",
  "ar-sa": "ar",
  "ar-eg": "ar",
  "ar-ae": "ar",
};

const INTL_LOCALES: Record<Locale, string> = {
  en: "en",
  fr: "fr",
  es: "es",
  pt: "pt",
  de: "de",
  it: "it",
  ja: "ja",
  zh: "zh-Hans",
  ko: "ko",
  hi: "hi",
  ar: "ar",
};

export function isLocale(value: string | undefined): value is Locale {
  return Boolean(value && (LOCALES as readonly string[]).includes(value));
}

export function directionFor(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

export function intlLocaleFor(locale: string): string {
  const resolved = resolveLocaleTag(locale) ?? DEFAULT_LOCALE;
  return INTL_LOCALES[resolved];
}

export function resolveLocaleTag(tag: string | undefined): Locale | undefined {
  if (!tag) return undefined;
  const lower = tag.trim().toLowerCase();
  if (!lower) return undefined;
  if (isLocale(lower)) return lower;
  if (LOCALE_ALIASES[lower]) return LOCALE_ALIASES[lower];
  const primary = lower.split("-")[0];
  if (isLocale(primary)) return primary;
  return LOCALE_ALIASES[primary];
}

export function parseAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((item) => item.trim().startsWith("q="));
      const quality = q ? Number(q.trim().slice(2)) : 1;
      return { tag: tag?.trim() ?? "", quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((item) => item.tag)
    .sort((a, b) => b.quality - a.quality)
    .map((item) => item.tag);
}

export function negotiateLocale(
  acceptLanguage: string | null | undefined,
  fallback: Locale = DEFAULT_LOCALE,
): Locale {
  if (!acceptLanguage?.trim()) return fallback;
  for (const tag of parseAcceptLanguage(acceptLanguage)) {
    const resolved = resolveLocaleTag(tag);
    if (resolved) return resolved;
  }
  return fallback;
}
