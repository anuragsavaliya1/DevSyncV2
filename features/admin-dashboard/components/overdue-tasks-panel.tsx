"use client";

import { ListTodo } from "lucide-react";
import { EmptyState } from "@/components/shared/error-state";
import type { AdminDashboardOverdueTaskRow } from "@/types/api.types";

function priorityTone(priority: AdminDashboardOverdueTaskRow["priority"]) {
  if (priority === "urgent") {
    return "border-[#F0C9C4] bg-[#FFF1EF] text-[#A64D43]";
  }
  if (priority === "high") {
    return "border-[#F0D7B0] bg-[#FFF4E5] text-[#A87532]";
  }
  if (priority === "medium") {
    return "border-[#D7EEE9] bg-[#F3FBFA] text-[#0E9384]";
  }
  return "border-[#E5EDF0] bg-[#F7FAFB] text-[#617687]";
}

export function OverdueTasksPanel({
  rows,
  onOpenEmployee,
}: {
  rows: AdminDashboardOverdueTaskRow[];
  onOpenEmployee?: (employeeId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold tracking-[-0.02em] text-[#173247]">
            Overdue tasks
          </h3>
          <p className="mt-1 text-xs font-medium leading-5 text-[#718494]">
            Pending assigned work past its due date for each employee
          </p>
        </div>
        <span
          aria-label={`${rows.length} overdue tasks`}
          className="inline-flex min-w-8 shrink-0 items-center justify-center rounded-full border border-[#F0C9C4] bg-[#FFF1EF] px-2.5 py-1 text-xs font-extrabold tabular-nums text-[#A64D43]"
        >
          {rows.length}
        </span>
      </div>
      <div className="p-4 sm:p-5">
        {rows.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No overdue tasks."
            detail="Pending assigned tasks that pass their due date will appear here by employee."
          />
        ) : (
          <div className="ds-data-table-wrap">
            <table className="ds-data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="min-w-[10rem]">Task</th>
                  <th>Priority</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {onOpenEmployee ? (
                        <button
                          type="button"
                          onClick={() => onOpenEmployee(row.employeeId)}
                          className="font-extrabold text-[#0E9384] hover:underline"
                        >
                          {row.employeeName}
                        </button>
                      ) : (
                        <span className="font-extrabold text-[#294354]">
                          {row.employeeName}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[16rem] font-medium text-[#617687]">
                      <span
                        className="line-clamp-2"
                        title={row.description || undefined}
                      >
                        {row.description || "—"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${priorityTone(row.priority)}`}
                      >
                        {row.priorityLabel}
                      </span>
                    </td>
                    <td className="whitespace-nowrap font-extrabold text-[#A64D43]">
                      {row.dueLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
