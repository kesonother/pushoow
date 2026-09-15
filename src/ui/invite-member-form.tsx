"use client";

import { useState } from "react";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function InviteMemberForm({
  organizationId,
  customRoles = [],
}: {
  organizationId: string;
  customRoles?: Array<{ id: string; name: string }>;
}) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    setLink(null);
    const response = await fetch(`/api/v1/organizations/${organizationId}/invitations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(formData.get("email") ?? ""),
        role: String(formData.get("role") ?? "read_only"),
        customRoleId: String(formData.get("customRoleId") ?? "") || undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(apiMessage(payload, t.errors.unableToInvite));
      return;
    }
    if (payload.data?.token) {
      setLink(`${window.location.origin}/invitations/accept?token=${payload.data.token}`);
    }
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input name="email" type="email" label={t.common.email} required />
      </div>
      <label className="text-sm font-medium">
        {t.common.role}
        <select name="role" className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 px-3" defaultValue="read_only">
          <option value="admin">{t.common.roleAdmin}</option>
          <option value="editor">{t.common.roleEditor}</option>
          <option value="check_in_manager">{t.common.roleCheckIn}</option>
          <option value="finance">{t.common.roleFinance}</option>
          <option value="read_only">{t.common.roleReadOnly}</option>
          {customRoles.length > 0 ? <option value="custom">{t.common.roleCustom}</option> : null}
        </select>
      </label>
      {customRoles.length > 0 ? (
        <label className="text-sm font-medium">
          {t.common.customRole}
          <select name="customRoleId" className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 px-3">
            <option value="">—</option>
            {customRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Button type="submit">{t.common.invite}</Button>
      {error ? (
        <p role="alert" className="text-sm text-red-700 sm:w-full">
          {error}
        </p>
      ) : null}
      {link ? (
        <p role="status" className="text-sm text-zinc-700 sm:w-full">
          {link}
        </p>
      ) : null}
    </form>
  );
}
