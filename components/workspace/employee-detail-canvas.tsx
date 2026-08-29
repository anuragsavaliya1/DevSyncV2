/** Context-preserving Manager/Admin employee review canvas for DevSync v2. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Archive, CheckCircle2, ClipboardList, LoaderCircle, MessageSquare, Search, Send, X } from "lucide-react";
import { EmployeeDetailSkeleton } from "@/components/workspace/loading-skeletons";

type Role = "developer" | "manager" | "admin";
type Employee = { id: string; email: string; displayName: string | null; photoUrl: string | null; role: Role; isActive: boolean };
type WorkUpdate = { id: string; updateDate: string; tasks: { id: string; description: string; minutes: number }[]; totalMinutes: number; blockers: string | null };
type AssignedTask = { id: string; description: string; status: "pending" | "completed"; assignedAt: string; completedAt: string | null; remarks: { id: string; userName: string; text: string; createdAt: string }[] };
type DetailData = { employee: Employee; updates: WorkUpdate[]; tasks: { pending: AssignedTask[]; completed: AssignedTask[] }; summary: { totalUpdates: number; totalMinutes: number; pendingTasks: number } };
type Range = "last_7_days" | "this_month" | "all_time";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request failed.");
  return data as T;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const formatDate = (value: string) => dateFormat.format(new Date(`${value}T12:00:00Z`));
const formatTime = (value: string | null) => value ? timeFormat.format(new Date(value)) : "—";
const duration = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes}m`;
const employeeName = (employee: Employee) => employee.displayName || employee.email;

export function EmployeeDetailCanvas({ employeeId, viewerRole, onBack, onChanged }: { employeeId: string; viewerRole: Role; onBack: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [range, setRange] = useState<Range>("last_7_days");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [taskTab, setTaskTab] = useState<"pending" | "completed">("pending");
  const [assignDescription, setAssignDescription] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [remarkDrafts, setRemarkDrafts] = useState<Record<string, string>>({});
  const [archiveTarget, setArchiveTarget] = useState<AssignedTask | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (query.trim()) params.set("query", query.trim());
      setDetail(await request<DetailData>(`/api/team/members/${employeeId}?${params.toString()}`));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load employee details."); }
    finally { setIsLoading(false); }
  }, [employeeId, fromDate, query, range, toDate]);

  useEffect(() => { void reload(); }, [reload]);

  async function run(action: () => Promise<void>, successMessage?: string) {
    setIsBusy(true); setError(null); setSuccess(null);
    try { await action(); await reload(); onChanged(); if (successMessage) setSuccess(successMessage); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Action failed."); }
    finally { setIsBusy(false); }
  }

  const employee = detail?.employee;
  const visibleTasks = detail?.tasks[taskTab] || [];

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-[#DDE7EB] bg-white px-3 py-2 text-xs font-extrabold text-[#526B7B] transition hover:border-[#AFCAC4] hover:text-[#087A6D]"><ArrowLeft className="h-4 w-4" />Back to team status</button>
      {employee && <div className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${employee.isActive ? "bg-[#EAF7F4] text-[#087A6D]" : "bg-[#FFF1EF] text-[#A64D43]"}`}>{employee.isActive ? "Active employee" : "Inactive employee"}</div>}
    </div>

    {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-[#F4C9C4] bg-[#FFF5F4] px-4 py-3 text-xs font-semibold text-[#A64D43]"><X className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    {success && <div role="status" className="flex items-start gap-3 rounded-xl border border-[#CDE9E3] bg-[#F3FBF8] px-4 py-3 text-xs font-semibold text-[#087A6D]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</div>}
    {isLoading && !detail ? <EmployeeDetailSkeleton /> : detail && <>
      <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF7F4] text-sm font-extrabold text-[#087A6D]">{employeeName(detail.employee).split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">Employee operations</p><h2 className="mt-1 truncate text-xl font-extrabold tracking-[-0.035em]">{employeeName(detail.employee)}</h2><p className="mt-1 truncate text-xs font-medium text-[#718494]">{detail.employee.email} · {detail.employee.role}</p></div></div><div className="flex gap-2"><Metric label="Updates" value={String(detail.summary.totalUpdates)} /><Metric label="Hours" value={duration(detail.summary.totalMinutes)} /><Metric label="Open tasks" value={String(detail.summary.pendingTasks)} /></div></div></section>

      <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">Assign a task</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input disabled={!detail.employee.isActive || isBusy} value={assignDescription} onChange={(event) => setAssignDescription(event.target.value)} placeholder={detail.employee.isActive ? "What needs to be done?" : "Inactive employees cannot receive new tasks"} className="min-w-0 flex-1 rounded-xl border border-[#DDE7EB] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#0E9384] disabled:cursor-not-allowed disabled:bg-[#F5F7F8]" /><button disabled={isBusy || !detail.employee.isActive || assignDescription.trim().length < 3} onClick={() => void run(async () => { await request("/api/tasks", { method: "POST", body: JSON.stringify({ developerUserId: employeeId, description: assignDescription }) }); setAssignDescription(""); }, "Task assigned and notification created.")} className="rounded-xl bg-[#173247] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#21445E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">{isBusy ? <><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Saving…</> : "Assign task"}</button></div></section>

      <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0F2] p-5"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">Assigned tasks</p><h3 className="mt-1 text-lg font-extrabold">Task review</h3></div><div className="flex rounded-lg bg-[#F2F6F7] p-1"><button onClick={() => setTaskTab("pending")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-extrabold ${taskTab === "pending" ? "bg-white text-[#173247] shadow-sm" : "text-[#7B8D99]"}`}>Pending · {detail.tasks.pending.length}</button><button onClick={() => setTaskTab("completed")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-extrabold ${taskTab === "completed" ? "bg-white text-[#173247] shadow-sm" : "text-[#7B8D99]"}`}>Completed · {detail.tasks.completed.length}</button></div></div><div className="divide-y divide-[#EEF3F5]">{visibleTasks.length ? visibleTasks.map((task) => <article key={task.id} className="p-5"><div className="flex gap-3"><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${task.status === "completed" ? "bg-[#EAF7F4] text-[#087A6D]" : "bg-[#F2F6F7] text-[#718494]"}`}><CheckCircle2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className={`text-sm font-extrabold ${task.status === "completed" ? "text-[#718494] line-through" : "text-[#294354]"}`}>{task.description}</p><p className="mt-1 text-[10px] font-semibold text-[#8496A1]">Assigned {formatTime(task.assignedAt)} · {task.status === "completed" ? `Completed ${formatTime(task.completedAt)}` : "Awaiting completion"}</p></div><div className="flex items-center gap-2"><button onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-extrabold text-[#087A6D] hover:bg-[#EAF7F4]"><MessageSquare className="h-3.5 w-3.5" />Remarks {task.remarks.length ? `(${task.remarks.length})` : ""}</button>{viewerRole === "admin" && <button onClick={() => setArchiveTarget(task)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-extrabold text-[#A64D43] hover:bg-[#FFF1EF]"><Archive className="h-3.5 w-3.5" />Archive</button>}</div></div>{expandedTaskId === task.id && <div className="mt-4 rounded-xl border border-[#E3ECEE] bg-[#FBFCFD] p-3"><div className="space-y-2">{task.remarks.length ? task.remarks.map((remark) => <p key={remark.id} className="rounded-lg bg-white px-3 py-2 text-[11px] font-medium text-[#627A8B]"><strong className="text-[#294354]">{remark.userName}:</strong> {remark.text}</p>) : <p className="text-xs font-medium text-[#8797A2]">No remarks yet.</p>}</div><div className="mt-3 flex gap-2"><input value={remarkDrafts[task.id] || ""} onChange={(event) => setRemarkDrafts((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Add a remark…" className="min-w-0 flex-1 rounded-lg border border-[#DDE7EB] bg-white px-2.5 py-1.5 text-xs font-medium outline-none focus:border-[#0E9384]" /><button disabled={isBusy || !(remarkDrafts[task.id] || "").trim()} onClick={() => void run(async () => { await request(`/api/tasks/${task.id}/remarks`, { method: "POST", body: JSON.stringify({ text: remarkDrafts[task.id] }) }); setRemarkDrafts((current) => ({ ...current, [task.id]: "" })); })} className="rounded-lg bg-[#EAF7F4] px-2.5 text-[10px] font-extrabold text-[#087A6D] disabled:opacity-50"><Send className="h-3.5 w-3.5" /></button></div></div>}</div></div></article>) : <div className="p-8"><Empty title={`No ${taskTab} tasks`} detail={taskTab === "pending" ? "New tasks assigned to this employee will appear here." : "Completed tasks remain available for accountable review."} /></div>}</div></section>

      <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">Work history</p><h3 className="mt-1 text-lg font-extrabold">Completed work and blockers</h3></div><div className="flex flex-wrap gap-1 rounded-lg bg-[#F2F6F7] p-1">{(["last_7_days", "this_month", "all_time"] as Range[]).map((value) => <button key={value} onClick={() => setRange(value)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-extrabold ${range === value ? "bg-white text-[#173247] shadow-sm" : "text-[#7B8D99]"}`}>{value === "last_7_days" ? "Last 7 days" : value === "this_month" ? "This month" : "All time"}</button>)}</div></div><div className="mt-4 grid gap-2 lg:grid-cols-[1fr_160px_160px_auto]"><label className="flex items-center gap-2 rounded-xl border border-[#DDE7EB] px-3 py-2.5"><Search className="h-4 w-4 text-[#8295A1]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks or blockers" className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none" /></label><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded-xl border border-[#DDE7EB] px-3 py-2 text-xs font-semibold outline-none focus:border-[#0E9384]" /><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded-xl border border-[#DDE7EB] px-3 py-2 text-xs font-semibold outline-none focus:border-[#0E9384]" /><button disabled={isLoading || isBusy} onClick={() => void reload()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#B9DCD5] bg-[#F5FBF9] px-4 py-2 text-xs font-extrabold text-[#087A6D] disabled:cursor-not-allowed disabled:opacity-60">{isLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}Apply</button></div><div className="mt-4 space-y-3">{detail.updates.length ? detail.updates.map((update) => <article key={update.id} className="rounded-xl border border-[#E6EEF0] p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-extrabold">{formatDate(update.updateDate)}</p><span className="text-xs font-extrabold text-[#0E9384]">{duration(update.totalMinutes)}</span></div><ul className="mt-3 space-y-1.5">{update.tasks.map((task) => <li key={task.id} className="flex justify-between gap-3 text-xs font-medium text-[#647B8C]"><span>{task.description}</span><span className="shrink-0 text-[#8294A0]">{duration(task.minutes)}</span></li>)}</ul>{update.blockers && <p className="mt-3 border-t border-[#EFF3F5] pt-3 text-xs font-medium text-[#9B6943]">Blocker: {update.blockers}</p>}</article>) : <Empty title="No matching work history" detail="Adjust the date or text filters to review another part of this employee’s recorded history." />}</div></section>
    </>}

    {archiveTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#173247]/35 p-4" role="dialog" aria-modal="true" aria-labelledby="archive-task-title"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#A64D43]">Admin confirmation</p><h3 id="archive-task-title" className="mt-1 text-xl font-extrabold">Archive this task?</h3><p className="mt-3 text-sm font-medium leading-6 text-[#6A8191]">“{archiveTarget.description}” will be removed from active queues. Its audit history remains retained and the action cannot be undone from the workspace.</p><div className="mt-6 flex justify-end gap-2"><button disabled={isBusy} onClick={() => setArchiveTarget(null)} className="rounded-xl border border-[#DDE7EB] px-4 py-2.5 text-xs font-extrabold text-[#5F7482]">Cancel</button><button disabled={isBusy} onClick={() => void run(async () => { await request(`/api/tasks/${archiveTarget.id}`, { method: "DELETE" }); setArchiveTarget(null); }, "Task archived. Its audit history has been retained.")} className="rounded-xl bg-[#A64D43] px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">{isBusy ? <><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Archiving…</> : "Archive task"}</button></div></div></div>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#E5EDF0] bg-[#FBFCFD] px-3 py-2 text-right"><p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">{label}</p><p className="mt-1 text-sm font-extrabold text-[#294354]">{value}</p></div>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="rounded-xl border border-dashed border-[#DDE7EA] bg-[#FBFCFD] px-4 py-8 text-center"><ClipboardList className="mx-auto h-5 w-5 text-[#0E9384]" /><p className="mt-3 text-xs font-extrabold text-[#486170]">{title}</p><p className="mx-auto mt-1 max-w-sm text-[11px] font-medium leading-5 text-[#8294A0]">{detail}</p></div>; }
