import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { ProfileForm } from "@/ui/profile-form";
import { SiteHeader } from "@/ui/site-header";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const { t } = await getI18n();
  const services = getServices();
  const profiles = await services.profiles.getProfiles(session.user.id, session.user.id);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.profile.title}</h1>
        {!session.user.emailVerified ? (
          <p>
            <a className="underline" href="/verify-email">
              {t.auth.verifyTitle}
            </a>
          </p>
        ) : null}
        <Card>
          <ProfileForm
            initial={{
              organizer: {
                displayName: profiles.organizer.displayName ?? "",
                avatarUrl: profiles.organizer.avatarUrl ?? "",
                bio: profiles.organizer.bio ?? "",
                website: profiles.organizer.website ?? "",
                linkedin: profiles.organizer.linkedin ?? "",
              },
              attendee: {
                displayName: profiles.attendee.displayName ?? "",
                avatarUrl: profiles.attendee.avatarUrl ?? "",
                bio: profiles.attendee.bio ?? "",
                website: profiles.attendee.website ?? "",
                linkedin: profiles.attendee.linkedin ?? "",
                visibility: profiles.attendee.visibility,
              },
            }}
            labels={{
              organizer: t.profile.organizer,
              attendee: t.profile.attendee,
              displayName: t.profile.displayName,
              avatar: t.profile.avatar,
              bio: t.profile.bio,
              website: t.profile.website,
              linkedin: t.profile.linkedin,
              visibility: t.profile.visibility,
              save: t.profile.save,
              privacyHint: t.profile.privacyHint,
            }}
          />
        </Card>
      </main>
    </div>
  );
}
