import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { AcceptInvitationForm } from "@/ui/accept-invitation-form";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  const { token } = await searchParams;
  const { t } = await getI18n();

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <Card>
          <AcceptInvitationForm token={token ?? ""} title={t.invitation.title} submit={t.invitation.accept} />
        </Card>
      </main>
    </div>
  );
}
