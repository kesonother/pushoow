import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { quietLinkClass } from "@/ui/theme";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main id="content" className="mx-auto flex min-h-full max-w-xl flex-col gap-4 px-6 py-20">
      <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.notFound.title}</h1>
      <p className="text-[14px] leading-[1.45] text-zinc-600">{t.notFound.body}</p>
      <Link href="/" className={quietLinkClass}>
        {t.notFound.home}
      </Link>
    </main>
  );
}
