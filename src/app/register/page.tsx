import type { Metadata } from "next";
import { enabledOAuthProviders } from "@/auth/providers";
import { getI18n } from "@/i18n/server";
import { AuthForm } from "@/ui/auth-form";
import { Card } from "@/ui/card";
import { PageShell } from "@/ui/page-shell";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a Pushoow account to publish calendars or RSVP to community events.",
  alternates: { canonical: "/register" },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { t } = await getI18n();
  const { ref } = await searchParams;

  return (
    <PageShell t={t} signedIn={false} width="narrow" className="justify-center py-12">
      <Card>
        <p className="mb-4 text-[13px] leading-[1.45] text-zinc-600">{t.onboarding.registerHint}</p>
        {ref ? <p className="mb-4 text-[13px] leading-[1.45] text-zinc-600">{t.referral.referredHint}</p> : null}
        <AuthForm
          mode="register"
          oauthProviders={enabledOAuthProviders()}
          labels={{
            title: t.auth.registerTitle,
            email: t.auth.email,
            password: t.auth.password,
            name: t.auth.name,
            submit: t.auth.submitRegister,
            passwordHint: t.auth.passwordHint,
            magicLink: t.auth.magicLink,
            magicLinkSent: t.auth.magicLinkSent,
            optionalPassword: t.auth.optionalPassword,
            or: t.auth.or,
            continueWith: t.auth.continueWith,
            captcha: t.privacy.captcha,
          }}
        />
      </Card>
    </PageShell>
  );
}
