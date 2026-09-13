import { describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, UnauthorizedError } from "@/domain/errors";
import { createOrganizationService } from "@/domain/organization/service";
import { createMemoryMembers, createMemoryOrganizations } from "@/test/fakes";

function service() {
  return createOrganizationService({
    organizations: createMemoryOrganizations(),
    members: createMemoryMembers(),
    ids: { id: () => `id_${Math.random().toString(16).slice(2)}` },
  });
}

describe("organization service", () => {
  it("creates an organization and assigns the actor as owner", async () => {
    const organizations = createMemoryOrganizations();
    const members = createMemoryMembers();
    const svc = createOrganizationService({ organizations, members });

    const created = await svc.createOrganization({
      actorUserId: "user_1",
      name: "Paris AI",
    });

    expect(created.slug).toBe("paris-ai");
    const membership = await members.findByUserAndOrganization("user_1", created.id);
    expect(membership?.role).toBe("owner");
  });

  it("rejects unauthenticated creation", async () => {
    await expect(
      service().createOrganization({ actorUserId: "", name: "Nope" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects duplicate slugs", async () => {
    const svc = service();
    await svc.createOrganization({ actorUserId: "user_1", name: "Dup" });
    await expect(
      svc.createOrganization({ actorUserId: "user_2", name: "Dup" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("lists only organizations the user belongs to", async () => {
    const svc = service();
    await svc.createOrganization({ actorUserId: "user_1", name: "Mine" });
    await svc.createOrganization({ actorUserId: "user_2", name: "Theirs" });

    const mine = await svc.listOrganizationsForUser("user_1");
    expect(mine.map((item) => item.slug)).toEqual(["mine"]);
  });

  it("forbids updates for read-only members", async () => {
    const svc = service();
    const created = await svc.createOrganization({
      actorUserId: "user_1",
      name: "Locked",
    });

    await expect(
      svc.updateOrganization(
        { userId: "user_2", organizationId: created.id, role: "read_only" },
        { name: "Hacked" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
