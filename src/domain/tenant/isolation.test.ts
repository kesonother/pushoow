import { describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/domain/errors";
import { assertSameTenant, belongsToTenant } from "@/domain/tenant/isolation";

describe("tenant isolation", () => {
  it("allows access when the resource belongs to the actor tenant", () => {
    const resource = { organizationId: "org_1" };
    expect(() => assertSameTenant(resource, "org_1")).not.toThrow();
    expect(belongsToTenant(resource, "org_1")).toBe(true);
  });

  it("rejects access to another tenant even if the caller knows the id", () => {
    expect(() =>
      assertSameTenant({ organizationId: "org_other" }, "org_1", "Calendar"),
    ).toThrow(ForbiddenError);
    expect(belongsToTenant({ organizationId: "org_other" }, "org_1")).toBe(false);
  });

  it("hides deleted or missing resources instead of leaking existence", () => {
    expect(() => assertSameTenant(null, "org_1", "Event")).toThrow(NotFoundError);
    expect(() =>
      assertSameTenant(
        { organizationId: "org_1", deletedAt: new Date() },
        "org_1",
        "Event",
      ),
    ).toThrow(NotFoundError);
  });
});
