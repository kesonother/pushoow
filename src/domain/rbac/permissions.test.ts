import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/domain/errors";
import {
  assertPermission,
  hasPermission,
  permissionsFor,
} from "@/domain/rbac/permissions";
import type { OrganizationRole } from "@/domain/rbac/roles";

const ROLES: OrganizationRole[] = [
  "owner",
  "admin",
  "editor",
  "check_in_manager",
  "finance",
  "read_only",
];

describe("RBAC permissions", () => {
  it("gives the owner every permission", () => {
    expect(permissionsFor("owner")).toContain("organization:delete");
    expect(hasPermission("owner", "checkin:manage")).toBe(true);
    expect(hasPermission("owner", "finance:write")).toBe(true);
  });

  it("prevents admin from deleting the organization", () => {
    expect(hasPermission("admin", "organization:delete")).toBe(false);
    expect(hasPermission("admin", "members:invite")).toBe(true);
  });

  it("limits check-in managers to operational check-in work", () => {
    expect(hasPermission("check_in_manager", "checkin:manage")).toBe(true);
    expect(hasPermission("check_in_manager", "registrants:read")).toBe(true);
    expect(hasPermission("check_in_manager", "events:update")).toBe(false);
    expect(hasPermission("check_in_manager", "finance:read")).toBe(false);
    expect(hasPermission("check_in_manager", "members:invite")).toBe(false);
  });

  it("gives finance billing access without event mutation", () => {
    expect(hasPermission("finance", "finance:write")).toBe(true);
    expect(hasPermission("finance", "events:publish")).toBe(false);
    expect(hasPermission("finance", "checkin:manage")).toBe(false);
  });

  it("keeps read-only users from mutating data", () => {
    expect(hasPermission("read_only", "organization:read")).toBe(true);
    expect(hasPermission("read_only", "events:create")).toBe(false);
    expect(hasPermission("read_only", "calendars:update")).toBe(false);
  });

  it("lets editors manage events but not members or billing", () => {
    expect(hasPermission("editor", "events:publish")).toBe(true);
    expect(hasPermission("editor", "members:invite")).toBe(false);
    expect(hasPermission("editor", "finance:write")).toBe(false);
  });

  it("throws when a role lacks a permission", () => {
    expect(() => assertPermission("read_only", "events:delete")).toThrow(
      ForbiddenError,
    );
  });

  it("defines permissions for every product role", () => {
    for (const role of ROLES) {
      expect(permissionsFor(role).length).toBeGreaterThan(0);
    }
  });
});
