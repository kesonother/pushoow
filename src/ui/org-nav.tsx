import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { hasPermission, type Actor } from "@/domain/rbac/permissions";

export function OrgNav({
  organizationId,
  actor,
  labels,
}: {
  organizationId: string;
  actor: Actor;
  labels: Dictionary["dashboard"];
}) {
  const base = `/dashboard/organizations/${organizationId}`;
  const links: Array<{ href: string; label: string; show: boolean }> = [
    { href: base, label: labels.insights, show: true },
    { href: `${base}/calendars`, label: labels.calendars, show: true },
    { href: `${base}/members`, label: labels.members, show: hasPermission(actor, "members:read") },
    { href: `${base}/roles`, label: labels.roles, show: hasPermission(actor, "members:read") },
    { href: `${base}/settings`, label: labels.settings, show: hasPermission(actor, "organization:read") },
    { href: `${base}/audit`, label: labels.audit, show: hasPermission(actor, "audit:read") },
    { href: `${base}/payments`, label: labels.payments, show: hasPermission(actor, "finance:read") },
    { href: `${base}/billing`, label: labels.billing, show: hasPermission(actor, "finance:read") },
    { href: `${base}/support`, label: labels.support, show: hasPermission(actor, "support:read") },
    {
      href: `${base}/agency`,
      label: labels.agency,
      show: !actor.viaAgency && hasPermission(actor, "agency:manage_clients"),
    },
  ];

  return (
    <nav className="flex flex-wrap gap-3 text-sm underline">
      {links
        .filter((item) => item.show)
        .map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
    </nav>
  );
}
