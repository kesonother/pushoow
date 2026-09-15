import { SOURCE_LOCALE, type Locale } from "@/i18n/config";
import { dictionaries, getDictionary } from "@/i18n/dictionaries";
import { extrasEn, extrasFr } from "@/i18n/messages/extras";
import { overlays } from "@/i18n/messages/overlays";
import { mergeCatalog } from "@/i18n/fallback";

export type FlatMessages = Record<string, string>;

export function flattenMessages(catalog: unknown, prefix = ""): FlatMessages {
  if (!catalog || typeof catalog !== "object") return {};
  const out: FlatMessages = {};
  for (const [key, value] of Object.entries(catalog as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flattenMessages(value, path));
  }
  return out;
}

export function unflattenMessages(flat: FlatMessages): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split(".");
    let current = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current[part] = value;
        return;
      }
      const next = current[part];
      if (!next || typeof next !== "object") current[part] = {};
      current = current[part] as Record<string, unknown>;
    });
  }
  return root;
}

export function sourceCatalog() {
  return mergeCatalog(dictionaries.en as unknown as Record<string, unknown>, extrasEn);
}

export function overlayFor(locale: Locale): unknown {
  if (locale === SOURCE_LOCALE) return sourceCatalog();
  if (locale === "fr") {
    return mergeCatalog(dictionaries.fr as unknown as Record<string, unknown>, extrasFr);
  }
  return overlays[locale as Exclude<Locale, "en" | "fr">] ?? {};
}

export function missingKeys(locale: Locale): string[] {
  const source = flattenMessages(sourceCatalog());
  if (locale === SOURCE_LOCALE) return [];
  const present = flattenMessages(overlayFor(locale));
  return Object.keys(source).filter((key) => !(key in present));
}

export function catalogForTranslationTool(locale: Locale) {
  return {
    format: "pushoow.i18n.v1",
    sourceLocale: SOURCE_LOCALE,
    locale,
    messages: flattenMessages(getDictionary(locale)),
    missing: missingKeys(locale),
  };
}
