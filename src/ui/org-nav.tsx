"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/client";
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
  const pathname = usePathname();
  const { t } = useI18n();
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
    <nav className="flex flex-wrap gap-1 text-sm" aria-label={t.common.orgNav}>
      {links
        .filter((item) => item.show)
        .map((item) => {
          const current = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={
                current
                  ? "inline-flex min-h-11 items-center rounded-full bg-[#111111] px-3 text-[13px] font-semibold text-white"
                  : "inline-flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-[#FAFAFA] hover:text-[#111111]"
              }
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
