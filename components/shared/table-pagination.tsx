"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type TablePaginationProps = {
  start: number;
  limit: number;
  total: number;
  onPageChange: (start: number) => void;
  /** Optional label shown left of controls. */
  label?: string;
};

/** Compact Prev/Next pager for data tables (start/limit). */
export function TablePagination({
  start,
  limit,
  total,
  onPageChange,
  label,
}: TablePaginationProps) {
  if (total <= 0) return null;

  const pageSize = Math.max(1, limit);
  const from = Math.min(start + 1, total);
  const to = Math.min(start + pageSize, total);
  const canPrev = start > 0;
  const canNext = start + pageSize < total;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAF0F2] px-4 py-3">
      <p className="text-[11px] font-semibold text-[#8294A0]">
        {label ? `${label} · ` : ""}
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous page"
          disabled={!canPrev}
          onClick={() => onPageChange(Math.max(0, start - pageSize))}
          className="inline-flex items-center gap-1 rounded-lg border border-[#E1EAED] bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-[#486170] hover:bg-[#F7FAFB] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={!canNext}
          onClick={() => onPageChange(start + pageSize)}
          className="inline-flex items-center gap-1 rounded-lg border border-[#E1EAED] bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-[#486170] hover:bg-[#F7FAFB] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
