import { directionFor, type Locale } from "@/i18n/config";

export const LOGICAL_TEXT = "text-start";
export const RTL_FLIP_CLASS = "rtl-flip";

export function isRtl(locale: Locale): boolean {
  return directionFor(locale) === "rtl";
}
