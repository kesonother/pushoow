import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";
import { ResendVerificationButton } from "@/ui/resend-verification-button";

export default async function VerifyEmailPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  const { t } = await getI18n();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <Card className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t.auth.verifyTitle}</h1>
          <p className="text-zinc-600">{t.auth.verifyBody}</p>
          <ResendVerificationButton label={t.auth.resendVerification} />
        </Card>
      </main>
    </div>
  );
}
