"use client";

import { useState } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function InviteMemberForm({
  organizationId,
  customRoles = [],
}: {
  organizationId: string;
  customRoles?: Array<{ id: string; name: string }>;
}) {
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
      setError(payload.error?.message ?? "Unable to invite");
      return;
    }
    if (payload.data?.token) {
      setLink(`${window.location.origin}/invitations/accept?token=${payload.data.token}`);
    }
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input name="email" type="email" label="Email" required />
      </div>
      <label className="text-sm font-medium">
        Role
        <select name="role" className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 px-3" defaultValue="read_only">
          <option value="admin">admin</option>
          <option value="editor">editor</option>
          <option value="check_in_manager">check-in manager</option>
          <option value="finance">finance</option>
          <option value="read_only">read-only</option>
          {customRoles.length > 0 ? <option value="custom">custom</option> : null}
        </select>
      </label>
      {customRoles.length > 0 ? (
        <label className="text-sm font-medium">
          Custom role
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
      <Button type="submit">Invite</Button>
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
