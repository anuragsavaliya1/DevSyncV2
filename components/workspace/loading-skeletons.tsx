import type { ReactNode } from "react";

const SkeletonBlock = ({ className = "" }: { className?: string }) => <span aria-hidden="true" className={`skeleton-shimmer block rounded-lg ${className}`} />;

function PanelSkeleton({ children }: { children: ReactNode }) {
  return <div role="status" aria-busy="true" className="space-y-5"><span className="sr-only">Loading workspace data…</span>{children}</div>;
}

export function WorkspaceSkeleton() {
  return <PanelSkeleton><div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]"><section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="w-full max-w-xs space-y-3"><SkeletonBlock className="h-2.5 w-24" /><SkeletonBlock className="h-6 w-56" /></div><SkeletonBlock className="h-7 w-24" /></div><div className="mt-6 space-y-3"><SkeletonBlock className="h-10 w-full" /><SkeletonBlock className="h-10 w-full" /><SkeletonBlock className="h-20 w-full" /><SkeletonBlock className="h-10 w-32" /></div></section><section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm"><SkeletonBlock className="h-2.5 w-24" /><SkeletonBlock className="mt-3 h-6 w-44" /><div className="mt-6 space-y-3"><SkeletonBlock className="h-20 w-full" /><SkeletonBlock className="h-20 w-full" /><SkeletonBlock className="h-20 w-full" /></div></section></div></PanelSkeleton>;
}

export function TeamStatusSkeleton() {
  return <PanelSkeleton><SkeletonBlock className="h-20 w-full" /><SkeletonBlock className="h-16 w-full" /><div className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white"><SkeletonBlock className="h-11 w-full rounded-none" /><div className="space-y-1 p-2"><SkeletonBlock className="h-16 w-full" /><SkeletonBlock className="h-16 w-full" /><SkeletonBlock className="h-16 w-full" /><SkeletonBlock className="h-16 w-full" /></div></div></PanelSkeleton>;
}

export function RoleManagementSkeleton() {
  return <PanelSkeleton><section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm"><div className="border-b border-[#EAF0F2] px-5 py-4"><SkeletonBlock className="h-2.5 w-32" /><SkeletonBlock className="mt-3 h-6 w-64" /><SkeletonBlock className="mt-2 h-4 w-full max-w-xl" /></div><div className="divide-y divide-[#EEF3F5]">{[1, 2, 3, 4].map((item) => <div key={item} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="flex items-center gap-3"><SkeletonBlock className="h-9 w-9 rounded-full" /><div className="space-y-2"><SkeletonBlock className="h-3 w-32" /><SkeletonBlock className="h-2.5 w-44" /></div></div><div className="flex gap-2"><SkeletonBlock className="h-8 w-16" /><SkeletonBlock className="h-8 w-24" /><SkeletonBlock className="h-8 w-20" /></div></div>)}</div></section></PanelSkeleton>;
}

export function EmployeeDetailSkeleton() {
  return <PanelSkeleton><SkeletonBlock className="h-10 w-40" /><section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><SkeletonBlock className="h-12 w-12 rounded-2xl" /><div className="space-y-3"><SkeletonBlock className="h-2.5 w-28" /><SkeletonBlock className="h-6 w-56" /><SkeletonBlock className="h-3 w-48" /></div></div><div className="flex gap-2"><SkeletonBlock className="h-16 w-20" /><SkeletonBlock className="h-16 w-20" /><SkeletonBlock className="h-16 w-20" /></div></div></section><SkeletonBlock className="h-28 w-full" /><SkeletonBlock className="h-64 w-full" /><SkeletonBlock className="h-80 w-full" /></PanelSkeleton>;
}
