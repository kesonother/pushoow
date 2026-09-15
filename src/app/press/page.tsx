import type { Metadata } from "next";
import { getSession } from "@/auth/session";
import { pressKit } from "@/domain/press/kit";
import { getI18n } from "@/i18n/server";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";

export const metadata: Metadata = {
  title: "Press kit",
  description: "Pushoow logos, screenshots, and fact sheet.",
  alternates: { canonical: "/press" },
  openGraph: {
    title: "Pushoow press kit",
    description: "Logos, screenshots, and a short fact sheet.",
  },
  twitter: {
    card: "summary",
    title: "Pushoow press kit",
    description: "Logos, screenshots, and a short fact sheet.",
  },
};

export default async function PressPage() {
  const { t } = await getI18n();
  const session = await getSession();
  const kit = pressKit();

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn={Boolean(session?.user)} />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
        <header className="grid gap-2">
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.press.title}</h1>
          <p className="text-zinc-600">{t.press.body}</p>
          <p className="text-sm text-zinc-600">
            {t.press.contact}:{" "}
            <a className="underline" href={`mailto:${kit.contactEmail}`}>
              {kit.contactEmail}
            </a>
          </p>
        </header>

        <Card>
          <h2 className="text-xl font-semibold">{t.press.facts}</h2>
          <dl className="mt-4 grid gap-3">
            {kit.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-sm font-medium">{fact.label}</dt>
                <dd className="text-sm text-zinc-600">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <section>
          <h2 className="mb-3 text-xl font-semibold">{t.press.logos}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {kit.logos.map((asset) => (
              <li key={asset.id}>
                <Card>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.href} alt="" className="h-24 w-full rounded-xl bg-zinc-100 object-contain p-4" />
                  <p className="mt-3 font-medium">{asset.label}</p>
                  <p className="mt-1 text-sm text-zinc-600">{asset.description}</p>
                  <a className="mt-2 inline-block text-sm underline" href={asset.href} download>
                    {t.press.download}
                  </a>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">{t.press.screenshots}</h2>
          <ul className="grid gap-3">
            {kit.screenshots.map((asset) => (
              <li key={asset.id}>
                <Card>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.href} alt="" className="w-full rounded-xl border border-[#E8E8E8]" />
                  <p className="mt-3 font-medium">{asset.label}</p>
                  <p className="mt-1 text-sm text-zinc-600">{asset.description}</p>
                  <a className="mt-2 inline-block text-sm underline" href={asset.href} download>
                    {t.press.download}
                  </a>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
