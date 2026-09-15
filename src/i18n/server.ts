import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  directionFor,
  isLocale,
  LOCALE_COOKIE,
  negotiateLocale,
  type Locale,
} from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return negotiateLocale((await headers()).get("accept-language"), DEFAULT_LOCALE);
}

export async function getI18n(): Promise<{
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Dictionary;
}> {
  const locale = await getLocale();
  return {
    locale,
    dir: directionFor(locale),
    t: getDictionary(locale),
  };
}
