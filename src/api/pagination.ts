import { ValidationError } from "@/domain/errors";

export type PageQuery = {
  limit: number;
  cursor?: string;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePageQuery(searchParams: URLSearchParams): PageQuery {
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Number(rawLimit) : DEFAULT_LIMIT;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new ValidationError("limit must be an integer between 1 and 100");
  }

  return {
    limit,
    cursor: searchParams.get("cursor") ?? undefined,
  };
}

export function paginateById<T extends { id: string }>(
  items: T[],
  query: PageQuery,
): Page<T> {
  const start = query.cursor ? items.findIndex((item) => item.id === query.cursor) + 1 : 0;
  const safeStart = start < 0 ? 0 : start;
  const slice = items.slice(safeStart, safeStart + query.limit);
  const last = slice.at(-1);
  const hasMore = safeStart + slice.length < items.length;

  return {
    items: slice,
    nextCursor: hasMore && last ? last.id : null,
  };
}
