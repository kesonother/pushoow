import { interpolate } from "@/i18n/fallback";
import { intlLocaleFor } from "@/i18n/config";

export type PluralForm = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function pluralCategory(locale: string, count: number): Intl.LDMLPluralRule {
  return new Intl.PluralRules(intlLocaleFor(locale)).select(count);
}

export function pluralize(locale: string, count: number, forms: PluralForm): string {
  const category = pluralCategory(locale, count);
  const template = forms[category] ?? forms.other;
  return interpolate(template, { count });
}
