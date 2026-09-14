import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import Link from "next/link";
import { NotificationPreferences } from "@/ui/notification-preferences";
import { PrivacySettings } from "@/ui/privacy-settings";
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
        <p>
          <Link className="underline" href="/privacy">
            {t.privacy.title}
          </Link>
        </p>
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
                appearOnRoster: profiles.attendee.appearOnRoster,
                showAvatar: profiles.attendee.showAvatar,
                showBio: profiles.attendee.showBio,
                showSocial: profiles.attendee.showSocial,
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
              appearOnRoster: t.profile.appearOnRoster,
              showAvatar: t.profile.showAvatar,
              showBio: t.profile.showBio,
              showSocial: t.profile.showSocial,
            }}
          />
        </Card>
        <Card>
          <PrivacySettings
            labels={{
              title: t.privacy.title,
              disclosure: t.privacy.disclosure,
              acknowledge: t.privacy.acknowledge,
              optOut: t.privacy.optOut,
              export: t.privacy.export,
              portability: t.privacy.portability,
              delete: t.privacy.delete,
              unavailable: t.notifications.unavailable,
            }}
          />
        </Card>
        <Card>
          <NotificationPreferences
            labels={{
              title: t.notifications.title,
              save: t.profile.save,
              tracking: t.notifications.tracking,
              smsOptIn: t.notifications.smsOptIn,
              phone: t.notifications.phone,
              unavailable: t.notifications.unavailable,
            }}
          />
        </Card>
      </main>
    </div>
  );
}
