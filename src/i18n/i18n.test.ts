import { describe, expect, it } from "vitest";
import {
  addMinor,
  defineCurrency,
  formatMoney,
  isZeroDecimalCurrency,
  minorDigits,
  multiplyMinor,
  normalizeCurrency,
  parseMajorToMinor,
  subtractMinor,
  SUPPORTED_CURRENCIES,
  toMinor,
} from "@/domain/payments/currencies";
import { directionFor, LOCALES, negotiateLocale, SOURCE_LOCALE } from "@/i18n/config";
import { assertIanaTimeZone, formatEventDateTime, isIanaTimeZone, partsInZone } from "@/i18n/datetime";
import { getDictionary } from "@/i18n/dictionaries";
import { messageAt, mergeCatalog } from "@/i18n/fallback";
import { TEXT_OVERFLOW_CLASS, wouldOverflow } from "@/i18n/overflow";
import { pluralCategory, pluralize } from "@/i18n/plural";
import { catalogForTranslationTool, flattenMessages, missingKeys, unflattenMessages } from "@/i18n/tooling";
import { extrasEn } from "@/i18n/messages/extras";

describe("locales", () => {
  it("prepares all eleven languages with a complete catalog", () => {
    expect(LOCALES).toEqual(["en", "fr", "es", "pt", "de", "it", "ja", "zh", "ko", "hi", "ar"]);
    for (const locale of LOCALES) {
      const t = getDictionary(locale);
      expect(t.brand).toBe("Pushoow");
      expect(t.nav.home.length).toBeGreaterThan(0);
      expect(t.locale[locale].length).toBeGreaterThan(0);
      expect(t.errors.requestFailed.length).toBeGreaterThan(0);
    }
  });

  it("negotiates Accept-Language including zh-CN and pt-BR", () => {
    expect(negotiateLocale("zh-CN,en;q=0.8")).toBe("zh");
    expect(negotiateLocale("pt-BR")).toBe("pt");
    expect(negotiateLocale("en-US,en;q=0.9")).toBe("en");
    expect(negotiateLocale("xx,yy")).toBe("fr");
  });

  it("falls back to English then to the raw key", () => {
    const spanish = getDictionary("es");
    expect(spanish.nav.discover).not.toBe(getDictionary("en").nav.discover);
    expect(spanish.profile.title).toBe(getDictionary("en").profile.title);
    const merged = mergeCatalog({ nav: { home: "Home" } }, { nav: { home: "" } });
    expect(messageAt(merged, "nav.home")).toBe("Home");
    expect(messageAt({}, "missing.path", extrasEn)).toBe("missing.path");
  });
});

describe("RTL", () => {
  it("marks Arabic as rtl and other locales as ltr", () => {
    expect(directionFor("ar")).toBe("rtl");
    for (const locale of LOCALES.filter((item) => item !== "ar")) {
      expect(directionFor(locale)).toBe("ltr");
    }
  });
});

describe("dates and IANA timezones", () => {
  it("formats DST-safe instants in America/New_York", () => {
    expect(isIanaTimeZone("America/New_York")).toBe(true);
    expect(isIanaTimeZone("Not/AZone")).toBe(false);
    expect(() => assertIanaTimeZone("Not/AZone")).toThrow(/IANA/);

    const beforeSpring = new Date("2026-03-08T06:00:00.000Z");
    const afterSpring = new Date("2026-03-08T07:00:00.000Z");
    expect(partsInZone(beforeSpring, "America/New_York")).toMatchObject({ hour: 1, day: 8 });
    expect(partsInZone(afterSpring, "America/New_York")).toMatchObject({ hour: 3, day: 8 });

    const formatted = formatEventDateTime(afterSpring, "America/New_York", "en");
    expect(formatted).toMatch(/3/);
    expect(formatEventDateTime(afterSpring, "America/New_York", "ar")).not.toBe(formatted);
  });
});

describe("currencies", () => {
  it("supports 25 ISO currencies and an extensible registry", () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(25);
    for (const code of SUPPORTED_CURRENCIES) {
      expect(normalizeCurrency(code)).toBe(code);
      expect(formatMoney(1050, code, "en").length).toBeGreaterThan(0);
    }
    expect(isZeroDecimalCurrency("JPY")).toBe(true);
    expect(isZeroDecimalCurrency("KRW")).toBe(true);
    expect(minorDigits("EUR")).toBe(2);
    defineCurrency({ code: "THB", minorDigits: 2 });
    expect(normalizeCurrency("THB")).toBe("THB");
    expect(formatMoney(199, "THB", "en")).toMatch(/1[.,]99/);
  });

  it("never uses floats for money arithmetic", () => {
    expect(() => toMinor(10.5)).toThrow(/integer minor units/);
    const tenTen = parseMajorToMinor("10.10", "EUR");
    const ten = parseMajorToMinor("0.10", "EUR");
    expect(addMinor(tenTen, ten)).toBe(BigInt(1020));
    expect(subtractMinor(tenTen, ten)).toBe(BigInt(1000));
    expect(multiplyMinor(BigInt(10_000), { numerator: BigInt(250), denominator: BigInt(10_000) })).toBe(BigInt(250));
    expect(formatMoney(1050, "EUR", "en")).toMatch(/10[.,]50/);
    expect(formatMoney(1000, "JPY", "en")).toMatch(/1,000|1000/);
  });
});

describe("pluralization", () => {
  it("covers English, French, Japanese, and Arabic categories", () => {
    expect(pluralCategory("en", 1)).toBe("one");
    expect(pluralCategory("en", 2)).toBe("other");
    expect(pluralCategory("fr", 0)).toBe("one");
    expect(pluralCategory("fr", 2)).toBe("other");
    expect(pluralCategory("ja", 1)).toBe("other");
    expect(pluralCategory("ar", 0)).toBe("zero");
    expect(pluralCategory("ar", 1)).toBe("one");
    expect(pluralCategory("ar", 2)).toBe("two");
    expect(pluralCategory("ar", 3)).toBe("few");
    expect(pluralCategory("ar", 11)).toBe("many");
    expect(pluralCategory("ar", 100)).toBe("other");

    const forms = {
      zero: "{count} zero",
      one: "{count} one",
      two: "{count} two",
      few: "{count} few",
      many: "{count} many",
      other: "{count} other",
    };
    expect(pluralize("ar", 2, forms)).toBe("2 two");
    expect(pluralize("ja", 5, forms)).toBe("5 other");
    expect(pluralize("en", 1, forms)).toBe("1 one");
  });
});

describe("text overflow", () => {
  it("detects long German compounds and CJK strings", () => {
    expect(TEXT_OVERFLOW_CLASS).toContain("truncate");
    expect(wouldOverflow("Donaudampfschifffahrtsgesellschaftskapitän", 20)).toBe(true);
    expect(wouldOverflow("日本語のイベントタイトルです", 8)).toBe(true);
    expect(wouldOverflow("Short", 20)).toBe(false);
  });
});

describe("translation tooling", () => {
  it("exports flattened catalogs with missing-key fallback metadata", () => {
    expect(SOURCE_LOCALE).toBe("en");
    expect(missingKeys("en")).toEqual([]);
    expect(missingKeys("fr")).toEqual([]);
    expect(missingKeys("es").length).toBeGreaterThan(0);
    const catalog = catalogForTranslationTool("de");
    expect(catalog.format).toBe("pushoow.i18n.v1");
    expect(catalog.missing.length).toBeGreaterThan(0);
    const flat = flattenMessages({ a: { b: "c" } });
    expect(flat).toEqual({ "a.b": "c" });
    expect(unflattenMessages(flat)).toEqual({ a: { b: "c" } });
  });
});
