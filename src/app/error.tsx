"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";
import { quietLinkClass } from "@/ui/theme";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();

  return (
    <main id="content" className="mx-auto flex min-h-full max-w-xl flex-col gap-4 px-6 py-20">
      <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.errorPage.title}</h1>
      <p role="alert" className="text-[14px] leading-[1.45] text-zinc-600">
        {t.errorPage.body}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={reset}>
          {t.errorPage.retry}
        </Button>
        <Link href="/" className={quietLinkClass}>
          {t.notFound.home}
        </Link>
      </div>
    </main>
  );
}
