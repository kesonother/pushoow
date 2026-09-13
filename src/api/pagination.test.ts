import { describe, expect, it } from "vitest";
import { ValidationError } from "@/domain/errors";
import { paginateById, parsePageQuery } from "@/api/pagination";

describe("pagination", () => {
  it("defaults to 20 items", () => {
    expect(parsePageQuery(new URLSearchParams())).toEqual({
      limit: 20,
      cursor: undefined,
    });
  });

  it("rejects invalid limits", () => {
    expect(() => parsePageQuery(new URLSearchParams("limit=0"))).toThrow(
      ValidationError,
    );
    expect(() => parsePageQuery(new URLSearchParams("limit=101"))).toThrow(
      ValidationError,
    );
  });

  it("returns a next cursor when more items remain", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const page = paginateById(items, { limit: 2 });
    expect(page.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("b");

    const next = paginateById(items, { limit: 2, cursor: "b" });
    expect(next.items.map((item) => item.id)).toEqual(["c"]);
    expect(next.nextCursor).toBeNull();
  });
});
