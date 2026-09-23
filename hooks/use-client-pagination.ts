"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LIST_PAGE_SIZE,
  paginateList,
} from "@/lib/pagination";

/** Client-side start/limit paging over an already-loaded list. */
export function useClientPagination<T>(
  items: readonly T[],
  pageSize: number = DEFAULT_LIST_PAGE_SIZE,
  /** Change this when filters change to jump back to the first page. */
  resetKey?: string | number,
) {
  const [start, setStart] = useState(0);
  const limit = Math.max(1, pageSize);

  useEffect(() => {
    setStart(0);
  }, [resetKey, limit]);

  useEffect(() => {
    if (start > 0 && start >= items.length) {
      const lastPageStart =
        Math.max(0, Math.floor((Math.max(items.length, 1) - 1) / limit)) *
        limit;
      setStart(lastPageStart);
    }
  }, [items.length, limit, start]);

  const page = useMemo(
    () => paginateList(items, start, limit),
    [items, start, limit],
  );

  return {
    pageItems: page.items,
    start: page.start,
    limit: page.limit,
    total: page.total,
    setStart,
    paginationProps: {
      start: page.start,
      limit: page.limit,
      total: page.total,
      onPageChange: setStart,
    },
  };
}
