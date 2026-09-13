import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/domain/errors";
import { resolveActor } from "@/api/authorize";
import { createMemoryMembers } from "@/test/fakes";

describe("authorization", () => {
  it("resolves an actor from a real membership only", async () => {
    const members = createMemoryMembers();
    await members.create({
      id: "mem_1",
      organizationId: "org_1",
      userId: "user_1",
      role: "editor",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const actor = await resolveActor(members, "user_1", "org_1");
    expect(actor.role).toBe("editor");
    expect(actor.organizationId).toBe("org_1");
  });

  it("rejects a client-supplied organization id without membership", async () => {
    const members = createMemoryMembers();
    await expect(resolveActor(members, "user_1", "org_other")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
