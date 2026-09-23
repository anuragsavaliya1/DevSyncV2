"use client";

import { useEffect, useState } from "react";
import { QUERY_CONFIG } from "@/constants/query-config";
import type { ListPageQuery } from "@/lib/pagination";

/**
 * Server-driven list pagination state.
 * Pass `pageQuery` into list hooks so each page change refetches with start/limit.
 */
export function useListPagination(
  /** Change this when filters change to jump back to the first page. */
  resetKey?: string | number,
  pageSize: number = QUERY_CONFIG.listPageSize,
) {
  const [start, setStart] = useState(0);
  const limit = Math.max(1, pageSize);

  useEffect(() => {
    setStart(0);
  }, [resetKey, limit]);

  const pageQuery: ListPageQuery = { start, limit };

  return {
    start,
    limit,
    setStart,
    pageQuery,
    paginationProps: (total: number) => ({
      start,
      limit,
      total,
      onPageChange: setStart,
    }),
  };
}
