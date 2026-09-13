import { enabledOAuthProviders } from "@/auth/providers";
import { getI18n } from "@/i18n/server";
import { AuthForm } from "@/ui/auth-form";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";

export default async function LoginPage() {
  const { t } = await getI18n();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn={false} />
      <main id="content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
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
            }}
          />
        </Card>
      </main>
    </div>
  );
}
