import { notFound, redirect } from "next/navigation";
import { resolveActor } from "@/api/authorize";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { InviteMemberForm } from "@/ui/invite-member-form";
import { SiteHeader } from "@/ui/site-header";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  const { organizationId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let members;
  try {
    const actor = await resolveActor(
      services.memberships,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    members = await services.members.listMembers(actor);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
        <InviteMemberForm organizationId={organizationId} />
        <ul className="flex flex-col gap-3">
          {members.map((member) => (
            <li key={member.id}>
              <Card>
                <p className="font-medium">{member.userId}</p>
                <p className="text-sm text-zinc-600">{member.role}</p>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
