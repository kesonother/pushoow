"use client";

import { LOCALES } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

export function LocaleSwitcher() {
  const { locale, t } = useI18n();

  async function onChange(next: string) {
    await fetch("/api/v1/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    window.location.reload();
  }

  return (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <span className="sr-only">{t.localeSwitcher.label}</span>
      <select
        value={locale}
        lang={locale}
        onChange={(event) => void onChange(event.target.value)}
        className="min-h-11 max-w-36 min-w-0 truncate rounded-full border border-[#E8E8E8] bg-white px-3 text-[13px] text-[#171717] transition-colors hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code} dir={code === "ar" ? "rtl" : "ltr"}>
            {t.locale[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
