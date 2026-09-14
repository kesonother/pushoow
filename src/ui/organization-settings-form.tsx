"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FUNCTIONAL_LEVELS, type Organization } from "@/domain/organization/types";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function OrganizationSettingsForm({
  organization,
  labels,
}: {
  organization: Organization;
  labels: {
    branding: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    billing: string;
    billingMode: string;
    billingOwn: string;
    billingConsolidated: string;
    functionalLevel: string;
    auditRetention: string;
    customDomain: string;
    domainKind: string;
    domainEmail: string;
    domainSite: string;
    addDomain: string;
    save: string;
    name: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/v1/organizations/${organization.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        logoUrl: String(formData.get("logoUrl") ?? "") || null,
        primaryColor: String(formData.get("primaryColor") ?? "") || null,
        secondaryColor: String(formData.get("secondaryColor") ?? "") || null,
        functionalLevel: String(formData.get("functionalLevel") ?? organization.functionalLevel),
        billingMode: String(formData.get("billingMode") ?? organization.billingMode),
        auditRetentionDays: Number(formData.get("auditRetentionDays") ?? organization.auditRetentionDays),
      }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to save");
      return;
    }
    router.refresh();
  }

  async function onAddDomain(formData: FormData) {
    setError(null);
    const response = await fetch(`/api/v1/organizations/${organization.id}/domains`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        domain: String(formData.get("domain") ?? ""),
        kind: String(formData.get("kind") ?? "site"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to add domain");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <form action={onSubmit} className="flex flex-col gap-4">
        <Input name="name" label={labels.name} defaultValue={organization.name} required minLength={2} />
        <h2 className="text-lg font-medium">{labels.branding}</h2>
        <Input name="logoUrl" label={labels.logoUrl} defaultValue={organization.logoUrl ?? ""} />
        <Input
          name="primaryColor"
          label={labels.primaryColor}
          defaultValue={organization.primaryColor ?? ""}
          placeholder="#112233"
        />
        <Input
          name="secondaryColor"
          label={labels.secondaryColor}
          defaultValue={organization.secondaryColor ?? ""}
          placeholder="#445566"
        />
        <h2 className="text-lg font-medium">{labels.billing}</h2>
        <label className="text-sm font-medium">
          {labels.functionalLevel}
          <select
            name="functionalLevel"
            className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 px-3"
            defaultValue={organization.functionalLevel}
          >
            {FUNCTIONAL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {labels.billingMode}
          <select
            name="billingMode"
            className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 px-3"
            defaultValue={organization.billingMode}
          >
            <option value="own">{labels.billingOwn}</option>
            <option value="consolidated">{labels.billingConsolidated}</option>
          </select>
        </label>
        <Input
          name="auditRetentionDays"
          type="number"
          label={labels.auditRetention}
          defaultValue={organization.auditRetentionDays}
          min={90}
          max={2555}
        />
        <Button type="submit" disabled={pending}>
          {labels.save}
        </Button>
      </form>
      <form action={onAddDomain} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input name="domain" label={labels.customDomain} required />
        </div>
        <label className="text-sm font-medium">
          {labels.domainKind}
          <select name="kind" className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 px-3" defaultValue="site">
            <option value="site">{labels.domainSite}</option>
            <option value="email">{labels.domainEmail}</option>
          </select>
        </label>
        <Button type="submit" variant="secondary">
          {labels.addDomain}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
