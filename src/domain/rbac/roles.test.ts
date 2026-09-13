import { describe, expect, it } from "vitest";
import { canAssignRole, canManageMember } from "@/domain/rbac/roles";

describe("role assignment guards", () => {
  it("lets an owner assign any role", () => {
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("owner", "read_only")).toBe(true);
  });

  it("prevents privilege escalation by admins and editors", () => {
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "editor")).toBe(true);
    expect(canAssignRole("editor", "admin")).toBe(false);
    expect(canAssignRole("editor", "read_only")).toBe(true);
  });

  it("prevents managing a peer or superior member", () => {
    expect(canManageMember("admin", "owner")).toBe(false);
    expect(canManageMember("admin", "admin")).toBe(false);
    expect(canManageMember("admin", "finance")).toBe(true);
    expect(canManageMember("owner", "owner")).toBe(true);
  });
});
