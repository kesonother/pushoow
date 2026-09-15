import type { Metadata } from "next";
import { enabledOAuthProviders } from "@/auth/providers";
import { getI18n } from "@/i18n/server";
import { AuthForm } from "@/ui/auth-form";
import { Card } from "@/ui/card";
import { PageShell } from "@/ui/page-shell";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to Pushoow with a magic link or an optional password.",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const { t } = await getI18n();

  return (
    <PageShell t={t} signedIn={false} width="narrow" className="justify-center py-12">
      <Card>
        <AuthForm
          mode="login"
          oauthProviders={enabledOAuthProviders()}
          labels={{
            title: t.auth.loginTitle,
            email: t.auth.email,
            password: t.auth.password,
            submit: t.auth.submitLogin,
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
