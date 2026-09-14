"use client";

import { useState } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

type ProfileValues = {
  organizer: {
    displayName: string;
    avatarUrl: string;
    bio: string;
    website: string;
    linkedin: string;
  };
  attendee: {
    displayName: string;
    avatarUrl: string;
    bio: string;
    website: string;
    linkedin: string;
    visibility: "private" | "organization" | "public";
    appearOnRoster: boolean;
    showAvatar: boolean;
    showBio: boolean;
    showSocial: boolean;
  };
};

export function ProfileForm({
  initial,
  labels,
}: {
  initial: ProfileValues;
  labels: {
    organizer: string;
    attendee: string;
    displayName: string;
    avatar: string;
    bio: string;
    website: string;
    linkedin: string;
    visibility: string;
    save: string;
    privacyHint: string;
    appearOnRoster: string;
    showAvatar: string;
    showBio: string;
    showSocial: string;
  };
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch("/api/v1/me/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizer: {
          displayName: String(formData.get("organizerDisplayName") ?? ""),
          avatarUrl: String(formData.get("organizerAvatar") ?? "") || null,
          bio: String(formData.get("organizerBio") ?? ""),
          website: String(formData.get("organizerWebsite") ?? "") || null,
          linkedin: String(formData.get("organizerLinkedin") ?? "") || null,
        },
        attendee: {
          displayName: String(formData.get("attendeeDisplayName") ?? ""),
          avatarUrl: String(formData.get("attendeeAvatar") ?? "") || null,
          bio: String(formData.get("attendeeBio") ?? ""),
          website: String(formData.get("attendeeWebsite") ?? "") || null,
          linkedin: String(formData.get("attendeeLinkedin") ?? "") || null,
          visibility: String(formData.get("attendeeVisibility") ?? "private"),
          appearOnRoster: formData.get("appearOnRoster") === "on",
          showAvatar: formData.get("showAvatar") === "on",
          showBio: formData.get("showBio") === "on",
          showSocial: formData.get("showSocial") === "on",
        },
      }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error?.message ?? "Unable to save profile");
      return;
    }
    setSaved(true);
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-lg font-semibold">{labels.organizer}</legend>
        <Input
          name="organizerDisplayName"
          label={labels.displayName}
          defaultValue={initial.organizer.displayName}
        />
        <Input
          name="organizerAvatar"
          label={labels.avatar}
          type="url"
          defaultValue={initial.organizer.avatarUrl}
        />
        <Input name="organizerBio" label={labels.bio} defaultValue={initial.organizer.bio} />
        <Input
          name="organizerWebsite"
          label={labels.website}
          type="url"
          defaultValue={initial.organizer.website}
        />
        <Input
          name="organizerLinkedin"
          label={labels.linkedin}
          type="url"
          defaultValue={initial.organizer.linkedin}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-lg font-semibold">{labels.attendee}</legend>
        <p className="text-sm text-zinc-600">{labels.privacyHint}</p>
        <Input
          name="attendeeDisplayName"
          label={labels.displayName}
          defaultValue={initial.attendee.displayName}
        />
        <Input
          name="attendeeAvatar"
          label={labels.avatar}
          type="url"
          defaultValue={initial.attendee.avatarUrl}
        />
        <Input name="attendeeBio" label={labels.bio} defaultValue={initial.attendee.bio} />
        <Input
          name="attendeeWebsite"
          label={labels.website}
          type="url"
          defaultValue={initial.attendee.website}
        />
        <Input
          name="attendeeLinkedin"
          label={labels.linkedin}
          type="url"
          defaultValue={initial.attendee.linkedin}
        />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900">
          {labels.visibility}
          <select
            name="attendeeVisibility"
            defaultValue={initial.attendee.visibility}
            className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3"
          >
            <option value="private">private</option>
            <option value="organization">organization</option>
            <option value="public">public</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="appearOnRoster" defaultChecked={initial.attendee.appearOnRoster} />
          {labels.appearOnRoster}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showAvatar" defaultChecked={initial.attendee.showAvatar} />
          {labels.showAvatar}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showBio" defaultChecked={initial.attendee.showBio} />
          {labels.showBio}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showSocial" defaultChecked={initial.attendee.showSocial} />
          {labels.showSocial}
        </label>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-zinc-700">
          Saved
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {labels.save}
      </Button>
    </form>
  );
}
