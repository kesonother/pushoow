import { enabledOAuthProviders } from "@/auth/providers";
import { getI18n } from "@/i18n/server";
import { AuthForm } from "@/ui/auth-form";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";

export default async function RegisterPage() {
  const { t } = await getI18n();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn={false} />
      <main id="content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <Card>
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
      </main>
    </div>
  );
}
