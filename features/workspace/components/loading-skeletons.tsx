import type { ReactNode } from "react";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton-shimmer block rounded-lg ${className}`}
    />
  );
}

function PanelSkeleton({
  children,
  label = "Loading workspace data…",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" className="space-y-5">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Matches My Updates: daily form + history | assigned queue */
export function WorkspaceSkeleton() {
  return (
    <PanelSkeleton>
      <div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <SkeletonBlock className="h-2.5 w-28" />
                <SkeletonBlock className="h-6 w-52" />
              </div>
              <SkeletonBlock className="h-10 w-52 rounded-xl" />
            </div>
            <div className="mt-5 space-y-3">
              {[0, 1].map(row => (
                <div
                  key={row}
                  className="rounded-xl border border-[#E4ECEF] bg-[#FBFCFD] p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_110px]">
                    <SkeletonBlock className="h-10 w-full rounded-lg" />
                    <SkeletonBlock className="h-10 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
            <SkeletonBlock className="mt-3 h-4 w-36" />
            <div className="mt-4 space-y-2">
              <SkeletonBlock className="h-2.5 w-32" />
              <SkeletonBlock className="h-20 w-full rounded-xl" />
            </div>
            <SkeletonBlock className="mt-4 h-10 w-36 rounded-xl" />
          </section>

          <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <SkeletonBlock className="h-2.5 w-24" />
                <SkeletonBlock className="h-5 w-48" />
              </div>
              <SkeletonBlock className="h-6 w-16 rounded-full" />
            </div>
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map(row => (
                <div
                  key={row}
                  className="rounded-xl border border-[#E6EEF0] p-3.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <SkeletonBlock className="h-3.5 w-28" />
                    <SkeletonBlock className="h-3.5 w-14" />
                  </div>
                  <div className="mt-2.5 space-y-2">
                    <SkeletonBlock className="h-3 w-full" />
                    <SkeletonBlock className="h-3 w-48 max-w-full" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm">
          <SkeletonBlock className="h-2.5 w-28" />
          <SkeletonBlock className="mt-2 h-5 w-40" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map(row => (
              <article
                key={row}
                className="rounded-xl border border-[#E6EEF0] p-3.5"
              >
                <div className="flex gap-3">
                  <SkeletonBlock className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <SkeletonBlock className="h-3.5 w-full max-w-sm" />
                    <SkeletonBlock className="h-2.5 w-28" />
                    <div className="mt-3 flex gap-2">
                      <SkeletonBlock className="h-8 min-w-0 flex-1 rounded-lg" />
                      <SkeletonBlock className="h-8 w-14 rounded-lg" />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PanelSkeleton>
  );
}

/** Matches Team updates: compliance bar + assign form + member table */
export function TeamStatusSkeleton() {
  return (
    <PanelSkeleton>
      <section className="rounded-2xl border border-[#E1EAED] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <SkeletonBlock className="h-2.5 w-28" />
            <SkeletonBlock className="h-4 w-44" />
          </div>
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-9 w-20 rounded-lg" />
            <SkeletonBlock className="h-9 w-36 rounded-lg" />
            <SkeletonBlock className="h-9 w-36 rounded-xl" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm">
        <SkeletonBlock className="h-2.5 w-28" />
        <div className="mt-3 grid gap-2 md:grid-cols-[220px_1fr_auto]">
          <SkeletonBlock className="h-12 w-full rounded-xl" />
          <SkeletonBlock className="h-12 w-full rounded-xl" />
          <SkeletonBlock className="h-12 w-28 rounded-xl" />
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
        <div className="min-w-[880px]">
          <div className="grid grid-cols-[1.1fr_90px_90px_1.35fr_160px] gap-4 border-b border-[#EAF0F2] bg-[#F8FAFB] px-5 py-3">
            <SkeletonBlock className="h-2.5 w-20" />
            <SkeletonBlock className="h-2.5 w-12" />
            <SkeletonBlock className="h-2.5 w-10" />
            <SkeletonBlock className="h-2.5 w-28" />
            <SkeletonBlock className="h-2.5 w-14" />
          </div>
          {[0, 1, 2, 3, 4].map(row => (
            <div
              key={row}
              className="grid grid-cols-[1.1fr_90px_90px_1.35fr_160px] gap-4 border-b border-[#EEF3F5] px-5 py-4 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <SkeletonBlock className="h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 space-y-1.5">
                  <SkeletonBlock className="h-3 w-28" />
                  <SkeletonBlock className="h-2.5 w-36" />
                </div>
              </div>
              <SkeletonBlock className="my-auto h-5 w-16 rounded-full" />
              <SkeletonBlock className="my-auto h-3.5 w-10" />
              <div className="my-auto space-y-1.5">
                <SkeletonBlock className="h-3 w-full max-w-xs" />
                <SkeletonBlock className="h-2.5 w-24" />
              </div>
              <SkeletonBlock className="my-auto h-3.5 w-24" />
            </div>
          ))}
        </div>
      </section>
    </PanelSkeleton>
  );
}

/** Matches Role management table */
export function RoleManagementSkeleton() {
  return (
    <PanelSkeleton>
      <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
        <div className="border-b border-[#EAF0F2] px-5 py-4">
          <SkeletonBlock className="h-2.5 w-36" />
          <SkeletonBlock className="mt-2 h-6 w-56" />
          <SkeletonBlock className="mt-2 h-3.5 w-full max-w-xl" />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[minmax(240px,1.4fr)_100px_150px_minmax(220px,1fr)] gap-3 border-b border-[#EAF0F2] bg-[#F8FAFB] px-5 py-3">
              <SkeletonBlock className="h-2.5 w-20" />
              <SkeletonBlock className="h-2.5 w-12" />
              <SkeletonBlock className="h-2.5 w-10" />
              <SkeletonBlock className="h-2.5 w-14" />
            </div>
            {[0, 1, 2, 3, 4].map(row => (
              <div
                key={row}
                className="grid grid-cols-[minmax(240px,1.4fr)_100px_150px_minmax(220px,1fr)] gap-3 border-b border-[#EEF3F5] px-5 py-4 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="space-y-1.5">
                    <SkeletonBlock className="h-3 w-32" />
                    <SkeletonBlock className="h-2.5 w-40" />
                  </div>
                </div>
                <SkeletonBlock className="my-auto h-5 w-14 rounded-full" />
                <SkeletonBlock className="my-auto h-9 w-[8.75rem] rounded-xl" />
                <div className="my-auto flex gap-2">
                  <SkeletonBlock className="h-8 w-24 rounded-lg" />
                  <SkeletonBlock className="h-8 w-20 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PanelSkeleton>
  );
}

/** Matches Employee detail canvas sections */
export function EmployeeDetailSkeleton() {
  return (
    <PanelSkeleton label="Loading employee details…">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SkeletonBlock className="h-9 w-44 rounded-xl" />
        <SkeletonBlock className="h-7 w-28 rounded-full" />
      </div>

      <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <SkeletonBlock className="h-12 w-12 shrink-0 rounded-2xl" />
            <div className="space-y-2">
              <SkeletonBlock className="h-2.5 w-32" />
              <SkeletonBlock className="h-6 w-48" />
              <SkeletonBlock className="h-3 w-56" />
            </div>
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-14 w-20 rounded-xl" />
            <SkeletonBlock className="h-14 w-20 rounded-xl" />
            <SkeletonBlock className="h-14 w-20 rounded-xl" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm">
        <SkeletonBlock className="h-2.5 w-24" />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <SkeletonBlock className="h-11 min-w-0 flex-1 rounded-xl" />
          <SkeletonBlock className="h-11 w-28 rounded-xl" />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0F2] p-5">
          <div className="space-y-2">
            <SkeletonBlock className="h-2.5 w-28" />
            <SkeletonBlock className="h-5 w-32" />
          </div>
          <SkeletonBlock className="h-9 w-48 rounded-lg" />
        </div>
        <div className="divide-y divide-[#EEF3F5]">
          {[0, 1, 2].map(row => (
            <div key={row} className="p-5">
              <div className="flex gap-3">
                <SkeletonBlock className="mt-0.5 h-6 w-6 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-full max-w-md" />
                  <SkeletonBlock className="h-2.5 w-40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <SkeletonBlock className="h-2.5 w-24" />
            <SkeletonBlock className="h-5 w-56" />
          </div>
          <SkeletonBlock className="h-9 w-56 rounded-lg" />
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_160px_160px_auto]">
          <SkeletonBlock className="h-11 w-full rounded-xl" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
          <SkeletonBlock className="h-11 w-20 rounded-xl" />
        </div>
        <div className="mt-4 space-y-3">
          {[0, 1].map(row => (
            <div key={row} className="rounded-xl border border-[#E6EEF0] p-4">
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock className="h-3.5 w-28" />
                <SkeletonBlock className="h-3.5 w-14" />
              </div>
              <div className="mt-3 space-y-2">
                <SkeletonBlock className="h-3 w-full" />
                <SkeletonBlock className="h-3 w-56 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </PanelSkeleton>
  );
}

/** Matches Attendance ledger team table */
export function AttendanceSkeleton() {
  return (
    <PanelSkeleton label="Loading attendance…">
      <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0F2] p-5">
          <div className="space-y-2">
            <SkeletonBlock className="h-2.5 w-28" />
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="h-3 w-72 max-w-full" />
          </div>
          <SkeletonBlock className="h-10 w-40 rounded-xl" />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[1.2fr_100px_110px_110px_1.3fr] gap-3 border-b border-[#EAF0F2] bg-[#F8FAFB] px-5 py-3">
              <SkeletonBlock className="h-2.5 w-24" />
              <SkeletonBlock className="h-2.5 w-12" />
              <SkeletonBlock className="h-2.5 w-14" />
              <SkeletonBlock className="h-2.5 w-16" />
              <SkeletonBlock className="h-2.5 w-20" />
            </div>
            {[0, 1, 2, 3, 4, 5].map(row => (
              <div
                key={row}
                className="grid grid-cols-[1.2fr_100px_110px_110px_1.3fr] gap-3 border-b border-[#EEF3F5] px-5 py-4 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <SkeletonBlock className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="space-y-1.5">
                    <SkeletonBlock className="h-3 w-28" />
                    <SkeletonBlock className="h-2.5 w-36" />
                  </div>
                </div>
                <SkeletonBlock className="my-auto h-5 w-14 rounded-full" />
                <SkeletonBlock className="my-auto h-3.5 w-16" />
                <SkeletonBlock className="my-auto h-3.5 w-16" />
                <SkeletonBlock className="my-auto h-2.5 w-40" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </PanelSkeleton>
  );
}

/** Compact work-history list placeholder under employee filters */
export function WorkHistoryListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <span className="sr-only">Loading work history…</span>
      {[0, 1, 2].map(row => (
        <div
          key={row}
          className="overflow-hidden rounded-xl border border-[#E1EAED] bg-[#FBFCFD]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#EAF0F2] bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 rounded-xl" />
              <div className="space-y-1.5">
                <SkeletonBlock className="h-3.5 w-28" />
                <SkeletonBlock className="h-2.5 w-20" />
              </div>
            </div>
            <SkeletonBlock className="h-6 w-14 rounded-full" />
          </div>
          <div className="space-y-0 divide-y divide-[#EEF3F5]">
            <div className="flex items-center gap-3 px-4 py-3">
              <SkeletonBlock className="h-6 w-6 rounded-full" />
              <SkeletonBlock className="h-3.5 flex-1" />
              <SkeletonBlock className="h-6 w-12 rounded-lg" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <SkeletonBlock className="h-6 w-6 rounded-full" />
              <SkeletonBlock className="h-3.5 w-2/3 max-w-full" />
              <SkeletonBlock className="h-6 w-12 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
