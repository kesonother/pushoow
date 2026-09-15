"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CUSTOM_GRANTS } from "@/domain/rbac/grants";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function CustomRoleForm({
  organizationId,
  labels,
}: {
  organizationId: string;
  labels: { roleName: string; grants: string; createRole: string };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    const grants = CUSTOM_GRANTS.filter((grant) => formData.get(grant) === "on");
    const response = await fetch(`/api/v1/organizations/${organizationId}/custom-roles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        grants,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(apiMessage(payload, t.errors.unableToCreateRole));
      return;
    }
    router.refresh();
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <Input name="name" label={labels.roleName} required minLength={2} />
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-medium">{labels.grants}</legend>
        {CUSTOM_GRANTS.map((grant) => (
          <label key={grant} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name={grant} />
            {grant}
          </label>
        ))}
      </fieldset>
      <Button type="submit">{labels.createRole}</Button>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
