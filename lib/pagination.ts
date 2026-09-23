/** Shared start/limit list pagination helpers. */

export type ListPagination = {
  start: number;
  limit: number;
  total: number;
};

export type ListPageQuery = {
  start: number;
  limit: number;
};

export type PaginatedList<T> = {
  items: T[];
  start: number;
  limit: number;
  total: number;
};

/** Normalized client result for a paged list API response. */
export type PaginatedListResult<T> = PaginatedList<T>;

export const DEFAULT_LIST_PAGE_SIZE = 10;
export const MAX_LIST_PAGE_SIZE = 100;

/** Parse start & limit from URL/search params (0-based start). */
export function parseListPagination(
  params: URLSearchParams | { start?: string | null; limit?: string | null },
  options?: { defaultLimit?: number; maxLimit?: number },
): { start: number; limit: number } {
  const defaultLimit = options?.defaultLimit ?? DEFAULT_LIST_PAGE_SIZE;
  const maxLimit = options?.maxLimit ?? MAX_LIST_PAGE_SIZE;
  const rawStart =
    params instanceof URLSearchParams
      ? params.get("start")
      : (params.start ?? null);
  const rawLimit =
    params instanceof URLSearchParams
      ? params.get("limit")
      : (params.limit ?? null);

  const start = Math.max(0, Number.parseInt(rawStart ?? "0", 10) || 0);
  let limit = Number.parseInt(rawLimit ?? String(defaultLimit), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(maxLimit, limit);
  return { start, limit };
}

/** Append start/limit to a query string builder when paging is requested. */
export function appendListPageParams(
  params: URLSearchParams,
  page?: ListPageQuery | null,
): URLSearchParams {
  if (!page) return params;
  params.set("start", String(Math.max(0, page.start)));
  params.set("limit", String(Math.max(1, page.limit)));
  return params;
}

/** Slice an in-memory list for start/limit pagination. */
export function paginateList<T>(
  items: readonly T[],
  start: number,
  limit: number,
): PaginatedList<T> {
  const total = items.length;
  const safeStart = Math.max(0, Math.min(start, total));
  const safeLimit = Math.max(1, limit);
  return {
    items: items.slice(safeStart, safeStart + safeLimit),
    start: safeStart,
    limit: safeLimit,
    total,
  };
}

export function paginationMeta(page: PaginatedList<unknown>): ListPagination {
  return {
    start: page.start,
    limit: page.limit,
    total: page.total,
  };
}

/**
 * If `start` or `limit` is present on the query, return a sliced page + meta.
 * Otherwise return the full list under `key` (backward-compatible).
 */
export function listResponseWithOptionalPaging<T>(
  key: string,
  items: readonly T[],
  searchParams: URLSearchParams,
  options?: { defaultLimit?: number; maxLimit?: number },
): Record<string, unknown> {
  const hasPaging =
    searchParams.has("start") || searchParams.has("limit");
  if (!hasPaging) {
    return { [key]: items };
  }
  const { start, limit } = parseListPagination(searchParams, options);
  const page = paginateList(items, start, limit);
  return {
    [key]: page.items,
    total: page.total,
    start: page.start,
    limit: page.limit,
  };
}

/** Normalize a list API payload into items + pagination meta. */
export function normalizePaginatedList<T>(
  items: T[],
  meta: { total?: number; start?: number; limit?: number },
  page?: ListPageQuery | null,
): PaginatedListResult<T> {
  const start = meta.start ?? page?.start ?? 0;
  const limit = meta.limit ?? page?.limit ?? Math.max(items.length, 1);
  const total = meta.total ?? items.length;
  return { items, start, limit, total };
}
