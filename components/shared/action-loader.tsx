import { LoaderCircle } from "lucide-react";

/** Simple spinner for mutations and soft refetches — not a page shimmer. */
export function ActionLoader({
  label = "Updating…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 py-8 text-xs font-semibold text-[#718494] ${className}`}
    >
      <LoaderCircle className="h-4 w-4 animate-spin text-[#0E9384]" />
      <span>{label}</span>
    </div>
  );
}

/** Lightweight overlay while an in-place action runs over existing UI. */
export function BusyOverlay({
  active,
  label = "Working…",
}: {
  active: boolean;
  label?: string;
}) {
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-white/70 backdrop-blur-[1px]"
    >
      <div className="inline-flex items-center gap-2 rounded-xl border border-[#E1EAED] bg-white px-3.5 py-2 text-xs font-semibold text-[#486170] shadow-sm">
        <LoaderCircle className="h-4 w-4 animate-spin text-[#0E9384]" />
        {label}
      </div>
    </div>
  );
}
