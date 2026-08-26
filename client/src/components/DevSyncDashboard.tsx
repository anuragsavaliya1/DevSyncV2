/**
 * Quiet Command Center design system: a white operational workspace with ink-navy structure,
 * Signal Teal action cues, ledger rules, and purposeful contextual overlays.
 */
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Clock3,
  Command,
  Ellipsis,
  FileText,
  Grid2X2,
  LayoutList,
  LogIn,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRoundCog,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

type ViewName = "Team Updates" | "My Updates" | "Attendance" | "Role Management";
type Role = "Developer" | "Manager" | "Admin";

type TeamMember = {
  id: number;
  name: string;
  initials: string;
  email: string;
  department: string;
  status: "Submitted" | "Pending";
  hours: string;
  tasks: { title: string; duration: string; time: string }[];
  blockers?: string;
  presence: "Working" | "Punched Out" | "Absent";
  punchIn?: string;
  punchOut?: string;
  role: Role;
  tone: string;
};

type Notice = { id: number; title: string; detail: string; time: string; read: boolean; tone: string };

const signalTeal = "#0E9384";
const logoUrl = "/manus-storage/devsync-logo-mark_e18f72f7.png";
const pulseRibbonUrl = "/manus-storage/devsync-pulse-ribbon_13fb0a6d.jpg";
const teamOrbitUrl = "/manus-storage/devsync-team-orbit_4ac00ce9.jpg";
const attendanceOrbitUrl = "/manus-storage/devsync-attendance-orbit_55960be7.jpg";

const teamMembers: TeamMember[] = [
  { id: 1, name: "Anurag Savaliya", initials: "AS", email: "anurag@xitijinfotech.com", department: "Engineering", status: "Submitted", hours: "8h 30m", tasks: [{ title: "Reviewed payment reconciliation flow", duration: "3h 15m", time: "10:20 AM" }, { title: "Aligned DevSync interaction states", duration: "5h 15m", time: "3:10 PM" }], presence: "Working", punchIn: "8:56 AM", role: "Admin", tone: "bg-[#E4F3F0] text-[#0E786C]" },
  { id: 2, name: "Bhautik Xitij", initials: "BX", email: "bhautik@xitijinfotech.com", department: "Backend", status: "Submitted", hours: "8h", tasks: [{ title: "Optimised socket event batching", duration: "4h", time: "11:10 AM" }, { title: "Stabilised notification payloads", duration: "4h", time: "4:40 PM" }], presence: "Working", punchIn: "9:04 AM", role: "Developer", tone: "bg-[#EAF0FF] text-[#3159AF]" },
  { id: 3, name: "Nency Donda", initials: "ND", email: "nency@xitijinfotech.com", department: "Flutter", status: "Submitted", hours: "7h 45m", tasks: [{ title: "Resolved onboarding field validation", duration: "2h 45m", time: "10:45 AM" }, { title: "Prepared account settings handoff", duration: "5h", time: "2:35 PM" }], blockers: "Awaiting final copy for empty states.", presence: "Punched Out", punchIn: "8:58 AM", punchOut: "6:05 PM", role: "Developer", tone: "bg-[#FFF2DD] text-[#A86512]" },
  { id: 4, name: "Darshak Golakiya", initials: "DG", email: "darshak@xitijinfotech.com", department: "Operations", status: "Submitted", hours: "8h 15m", tasks: [{ title: "Triaged release readiness checklist", duration: "3h 30m", time: "10:10 AM" }, { title: "Mapped QA escalation owners", duration: "4h 45m", time: "4:20 PM" }], presence: "Working", punchIn: "8:52 AM", role: "Admin", tone: "bg-[#F0EAFE] text-[#6842B0]" },
  { id: 5, name: "Harsh Virani", initials: "HV", email: "harsh@xitijinfotech.com", department: "Android", status: "Pending", hours: "—", tasks: [], presence: "Working", punchIn: "9:11 AM", role: "Developer", tone: "bg-[#E8F2FA] text-[#2D6F99]" },
  { id: 6, name: "Priya Shah", initials: "PS", email: "priya@xitijinfotech.com", department: "Frontend", status: "Submitted", hours: "8h 10m", tasks: [{ title: "Built account approval empty state", duration: "3h 40m", time: "11:00 AM" }, { title: "QA fixed responsive audit issues", duration: "4h 30m", time: "4:55 PM" }], presence: "Punched Out", punchIn: "9:02 AM", punchOut: "6:24 PM", role: "Developer", tone: "bg-[#FFEDEF] text-[#AE485D]" },
  { id: 7, name: "Sanket Rupareliya", initials: "SR", email: "sanket@xitijinfotech.com", department: "Backend", status: "Pending", hours: "—", tasks: [], presence: "Working", punchIn: "9:07 AM", role: "Developer", tone: "bg-[#EAF6E8] text-[#478744]" },
  { id: 8, name: "Mansi Patel", initials: "MP", email: "mansi@xitijinfotech.com", department: "QA", status: "Submitted", hours: "7h 30m", tasks: [{ title: "Completed regression sweep for food module", duration: "4h 30m", time: "11:40 AM" }, { title: "Filed edge-case notes for team review", duration: "3h", time: "5:15 PM" }], presence: "Punched Out", punchIn: "9:09 AM", punchOut: "5:58 PM", role: "Developer", tone: "bg-[#F5EFDF] text-[#8B6D24]" },
  { id: 9, name: "Bhavin Mehta", initials: "BM", email: "bhavin@xitijinfotech.com", department: "Flutter", status: "Submitted", hours: "8h", tasks: [{ title: "Reworked purchase confirmation states", duration: "5h", time: "10:25 AM" }, { title: "Verified UPI fallback behavior", duration: "3h", time: "4:30 PM" }], presence: "Working", punchIn: "8:55 AM", role: "Developer", tone: "bg-[#F1EDFC] text-[#7051B8]" },
  { id: 10, name: "Grishma Patel", initials: "GP", email: "grishma@xitijinfotech.com", department: "Design", status: "Submitted", hours: "8h 20m", tasks: [{ title: "Prepared daily work update motion spec", duration: "4h 20m", time: "12:05 PM" }, { title: "Reviewed density of attendance table", duration: "4h", time: "5:10 PM" }], presence: "Working", punchIn: "8:59 AM", role: "Developer", tone: "bg-[#FFF0E4] text-[#B76123]" },
];

const initialNotices: Notice[] = [
  { id: 1, title: "Task completed", detail: "Nency completed “Account settings handoff”.", time: "12 min ago", read: false, tone: "bg-[#E4F3F0] text-[#0E786C]" },
  { id: 2, title: "Work update submitted", detail: "Bhautik logged 8 hours across 2 tasks.", time: "28 min ago", read: false, tone: "bg-[#EAF0FF] text-[#3159AF]" },
  { id: 3, title: "Blocker flagged", detail: "Nency needs final copy for empty states.", time: "52 min ago", read: false, tone: "bg-[#FFF2DD] text-[#A86512]" },
  { id: 4, title: "Late punch-in", detail: "Harsh punched in at 9:11 AM.", time: "1 hr ago", read: false, tone: "bg-[#FFEDEF] text-[#AE485D]" },
];

const navItems: { name: ViewName; icon: LucideIcon; hint: string }[] = [
  { name: "Team Updates", icon: UsersRound, hint: "Daily team status" },
  { name: "My Updates", icon: FileText, hint: "Your work log" },
  { name: "Attendance", icon: CalendarDays, hint: "Team presence" },
  { name: "Role Management", icon: ShieldCheck, hint: "Access control" },
];

function StatusBadge({ status }: { status: TeamMember["status"] }) {
  return (
    <Badge className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.01em]", status === "Submitted" ? "border-[#C9E8E1] bg-[#EAF7F4] text-[#08776B]" : "border-[#F1E0BA] bg-[#FFF8E8] text-[#A16C11]")}>{status}</Badge>
  );
}

function PresenceDot({ presence }: { presence: TeamMember["presence"] }) {
  const color = presence === "Working" ? "bg-[#11A991]" : presence === "Punched Out" ? "bg-[#7F8DA5]" : "bg-[#D7A23C]";
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white", color)} aria-label={presence} />;
}

function Person({ member, compact = false }: { member: TeamMember; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9 border border-white shadow-[0_3px_10px_rgba(23,45,69,0.08)]">
          <AvatarFallback className={cn("text-[11px] font-extrabold", member.tone)}>{member.initials}</AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -right-0.5"><PresenceDot presence={member.presence} /></span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-[#1A2C3C]">{member.name}</p>
        {!compact && <p className="mt-0.5 truncate text-[11px] font-medium text-[#8390A1]">{member.department}</p>}
      </div>
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8290A2]">{children}</p>;
}

export default function DevSyncDashboard() {
  const [activeView, setActiveView] = useState<ViewName>("Team Updates");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isGrid, setIsGrid] = useState(false);
  const [datePreset, setDatePreset] = useState("Today");
  const [date, setDate] = useState("2026-08-26");
  const [punchedIn, setPunchedIn] = useState(false);
  const [notifications, setNotifications] = useState(initialNotices);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [newUpdateOpen, setNewUpdateOpen] = useState(false);
  const [assignTaskOpen, setAssignTaskOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);
  const [search, setSearch] = useState("");
  const [remarkOpen, setRemarkOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskHours, setNewTaskHours] = useState("2h 30m");

  const unreadCount = notifications.filter((notice) => !notice.read).length;
  const visibleMembers = useMemo(() => teamMembers.filter((member) => member.name.toLowerCase().includes(search.toLowerCase())), [search]);
  const submitted = teamMembers.filter((member) => member.status === "Submitted").length;

  function changeView(next: ViewName) {
    setSelectedMember(null);
    setActiveView(next);
    setSearch("");
  }

  function punch() {
    setPunchedIn((current) => !current);
    toast.success(punchedIn ? "Punch-out recorded for 6:32 PM" : "You are punched in for today", { description: punchedIn ? "Your attendance record is ready." : "You can now add your work update." });
  }

  function markAllRead() {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    toast.success("All notifications marked as read");
  }

  function submitUpdate() {
    setNewUpdateOpen(false);
    setNewTaskText("");
    toast.success("Work update submitted", { description: "Your teammates can now see the progress in Team Updates." });
  }

  function assignTask() {
    setAssignTaskOpen(false);
    setNewTaskText("");
    toast.success("Task assigned", { description: `A notification was sent to ${selectedMember?.name ?? "the developer"}.` });
  }

  if (selectedMember) {
    return (
      <DashboardLayout
        activeView={activeView}
        onChangeView={changeView}
        punchedIn={punchedIn}
        onPunch={punch}
        unreadCount={unreadCount}
        notificationOpen={notificationOpen}
        setNotificationOpen={setNotificationOpen}
        notifications={notifications}
        markAllRead={markAllRead}
        markOneRead={(id) => setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item))}
      >
        <EmployeeDetail member={selectedMember} onBack={() => setSelectedMember(null)} onAssign={() => setAssignTaskOpen(true)} remarkOpen={remarkOpen} setRemarkOpen={setRemarkOpen} />
        <TaskDialog open={assignTaskOpen} onOpenChange={setAssignTaskOpen} value={newTaskText} onChange={setNewTaskText} onSubmit={assignTask} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      activeView={activeView}
      onChangeView={changeView}
      punchedIn={punchedIn}
      onPunch={punch}
      unreadCount={unreadCount}
      notificationOpen={notificationOpen}
      setNotificationOpen={setNotificationOpen}
      notifications={notifications}
      markAllRead={markAllRead}
      markOneRead={(id) => setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item))}
    >
      {activeView === "Team Updates" && (
        <TeamUpdates
          isGrid={isGrid}
          setIsGrid={setIsGrid}
          datePreset={datePreset}
          setDatePreset={setDatePreset}
          date={date}
          setDate={setDate}
          members={visibleMembers}
          search={search}
          setSearch={setSearch}
          submitted={submitted}
          onHistory={setSelectedMember}
        />
      )}
      {activeView === "My Updates" && <MyUpdates punchedIn={punchedIn} onOpenNew={() => setNewUpdateOpen(true)} />}
      {activeView === "Attendance" && <Attendance members={teamMembers} />}
      {activeView === "Role Management" && <RoleManagement members={teamMembers} onDelete={setDeleteTarget} onSetRole={setRoleTarget} />}

      <UpdateDialog open={newUpdateOpen} onOpenChange={setNewUpdateOpen} value={newTaskText} onChange={setNewTaskText} duration={newTaskHours} setDuration={setNewTaskHours} onSubmit={submitUpdate} />
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-[#E7ECF2] bg-white">
          <AlertDialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF0F2] text-[#C84D60]"><Trash2 className="h-4 w-4" /></div>
            <AlertDialogTitle className="font-display text-xl text-[#1A2C3C]">Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6E7C8F]">This is a UI prototype. In the connected product, the action should require a server-side permission check and preserve audit history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#DDE5ED]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#C84D60] hover:bg-[#AE3A4D]" onClick={() => { toast.success("Prototype action confirmed"); setDeleteTarget(null); }}>Remove user</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <RoleDialog target={roleTarget} onClose={() => setRoleTarget(null)} />
    </DashboardLayout>
  );
}

function DashboardLayout({ children, activeView, onChangeView, punchedIn, onPunch, unreadCount, notificationOpen, setNotificationOpen, notifications, markAllRead, markOneRead }: {
  children: React.ReactNode; activeView: ViewName; onChangeView: (view: ViewName) => void; punchedIn: boolean; onPunch: () => void; unreadCount: number; notificationOpen: boolean; setNotificationOpen: (open: boolean) => void; notifications: Notice[]; markAllRead: () => void; markOneRead: (id: number) => void;
}) {
  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#1A2C3C]">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[76px] flex-col border-r border-[#E5EBF1] bg-[#FEFEFE] px-3 py-5 lg:w-[248px] lg:px-4">
        <div className="mb-9 flex items-center gap-3 px-1.5 lg:px-2">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[#F0FAF8] ring-1 ring-[#D8F0EB]">
            <img src={logoUrl} alt="DevSync" className="h-7 w-7 object-contain" />
          </div>
          <div className="hidden lg:block">
            <p className="font-display text-[17px] font-extrabold tracking-[-0.045em] text-[#132A3A]">devsync</p>
            <p className="mt-0.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#91A0AF]">daily operating system</p>
          </div>
        </div>
        <nav className="space-y-1.5">
          <p className="mb-2 hidden px-3 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#9AA7B4] lg:block">Workspace</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.name;
            return (
              <button key={item.name} onClick={() => onChangeView(item.name)} className={cn("group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all duration-200 active:scale-[0.98] lg:px-3", isActive ? "bg-[#EAF7F4] text-[#0B7A6E] shadow-[inset_0_0_0_1px_rgba(14,147,132,0.08)]" : "text-[#647386] hover:bg-[#F3F6F9] hover:text-[#25394A]") }>
                <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-[#0E9384]" : "text-[#7B8A9C] group-hover:text-[#385268]")} />
                <span className="hidden min-w-0 flex-1 lg:block"><span className="block text-[13px] font-bold">{item.name}</span>{isActive && <span className="mt-0.5 block text-[10px] font-semibold text-[#54A89E]">{item.hint}</span>}</span>
                {isActive && <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-[#0E9384] lg:block" />}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto hidden overflow-hidden rounded-2xl border border-[#E2ECEC] bg-[#F8FCFB] p-3.5 lg:block">
          <div className="mb-2 flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[#0E9384]" /><p className="text-[11px] font-extrabold text-[#214250]">Daily rhythm</p></div>
          <p className="text-[11px] leading-5 text-[#718091]">14 of 24 teammates have shared work updates today.</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#DCEDEB]"><div className="h-full w-[58%] rounded-full bg-[#0E9384]" /></div>
          <button onClick={() => onChangeView("Team Updates")} className="mt-3 text-[11px] font-extrabold text-[#0B7A6E] hover:text-[#075F57]">View team pulse →</button>
        </div>
      </aside>
      <div className="min-h-screen pl-[76px] lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-[#E5EBF1] bg-[rgba(254,254,254,0.88)] px-5 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-2 text-[11px] font-bold text-[#8290A2]"><span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-md bg-[#EFF9F7] ring-1 ring-[#D8F0EB]"><img src={logoUrl} alt="" className="h-3.5 w-3.5" /></span><span className="font-display font-extrabold tracking-[-0.03em] text-[#1A3547]">devsync</span><span className="hidden text-[#B1BAC3] sm:inline">/</span><span className="hidden sm:inline">Xitij Infotech</span><span className="hidden sm:inline">/</span><span className="text-[#4E6071]">Operations</span></div>
          <div className="flex items-center gap-2.5">
            <Button onClick={onPunch} className={cn("hidden h-9 rounded-xl px-3.5 text-[12px] font-extrabold shadow-none transition-all duration-200 active:scale-[0.97] sm:flex", punchedIn ? "bg-[#F2F5F8] text-[#516275] hover:bg-[#E7EDF2]" : "bg-[#0E9384] text-white hover:bg-[#087D71]") }>
              {punchedIn ? <LogOut className="mr-1.5 h-3.5 w-3.5" /> : <LogIn className="mr-1.5 h-3.5 w-3.5" />}{punchedIn ? "Punch out" : "Punch in"}
            </Button>
            <button onClick={() => setNotificationOpen(true)} className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[#607284] transition-all hover:bg-[#F0F4F7] active:scale-[0.95]" aria-label="Open notifications"><Bell className="h-[18px] w-[18px]" />{unreadCount > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E66475] px-1 text-[9px] font-extrabold text-white">{unreadCount}</span>}</button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-[#F0F4F7]" aria-label="Open account menu"><Avatar className="h-7 w-7"><AvatarFallback className="bg-[#1E394B] text-[10px] font-extrabold text-white">AS</AvatarFallback></Avatar><ChevronDown className="hidden h-3.5 w-3.5 text-[#8390A1] sm:block" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 border-[#E3EAF0] bg-white p-1.5 shadow-[0_20px_50px_rgba(22,43,65,0.16)]">
                <DropdownMenuLabel className="px-2.5 py-2"><p className="text-[12px] font-extrabold text-[#1A2C3C]">Anurag Savaliya</p><p className="mt-0.5 text-[10px] font-medium text-[#8694A4]">Administrator</p></DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#E8EDF2]" />
                <DropdownMenuItem onClick={() => toast.message("Profile is part of the connected product.")} className="gap-2.5 rounded-lg text-[12px] font-semibold text-[#54677A]"><UsersRound className="h-3.5 w-3.5" />Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.message("Preferences are part of the connected product.")} className="gap-2.5 rounded-lg text-[12px] font-semibold text-[#54677A]"><Settings2 className="h-3.5 w-3.5" />Preferences</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#E8EDF2]" />
                <DropdownMenuItem onClick={() => toast.success("Signed out from prototype")} className="gap-2.5 rounded-lg text-[12px] font-semibold text-[#B94A5A]"><LogOut className="h-3.5 w-3.5" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="px-5 pb-10 pt-7 lg:px-8 lg:pt-8">{children}</main>
      </div>
      <NotificationSheet open={notificationOpen} onOpenChange={setNotificationOpen} notifications={notifications} unreadCount={unreadCount} onMarkAll={markAllRead} onMarkOne={markOneRead} />
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><SectionEyebrow>{eyebrow}</SectionEyebrow><h1 className="font-display text-[28px] font-extrabold tracking-[-0.04em] text-[#152C3D] sm:text-[32px]">{title}</h1><p className="mt-1.5 max-w-xl text-[13px] font-medium leading-6 text-[#718093]">{description}</p></div>{action}</div>;
}

function TeamUpdates({ isGrid, setIsGrid, datePreset, setDatePreset, date, setDate, members, search, setSearch, submitted, onHistory }: { isGrid: boolean; setIsGrid: (grid: boolean) => void; datePreset: string; setDatePreset: (preset: string) => void; date: string; setDate: (date: string) => void; members: TeamMember[]; search: string; setSearch: (search: string) => void; submitted: number; onHistory: (member: TeamMember) => void }) {
  return <>
    <PageHeading eyebrow="Team operations / 26 August" title="Daily team status" description="One calm view of who is present, what moved forward, and where a manager needs to unblock work." action={<div className="flex items-center gap-2"><Button variant="outline" onClick={() => toast.message("Export is available once this prototype is connected to real data.")} className="h-9 rounded-xl border-[#DCE5ED] bg-white px-3 text-[12px] font-extrabold text-[#5D7082] shadow-none"><ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />Export</Button><Button onClick={() => toast.success("Nudges queued", { description: "3 teammates will receive a daily update reminder." })} className="h-9 rounded-xl bg-[#1B3447] px-3.5 text-[12px] font-extrabold text-white shadow-none hover:bg-[#112B3D]"><Bell className="mr-1.5 h-3.5 w-3.5" />Nudge pending</Button></div>} />
    <section className="relative mb-5 overflow-hidden rounded-2xl border border-[#DDEBE8] bg-white p-5 shadow-[0_12px_40px_rgba(22,50,65,0.045)]">
      <img src={pulseRibbonUrl} alt="" className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[31%] object-cover opacity-[0.16] mix-blend-multiply lg:block" />
      <div className="relative grid gap-5 lg:grid-cols-[1.08fr_1.7fr] lg:items-center">
        <div className="border-b border-[#E5EFED] pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6"><SectionEyebrow>Live command readout</SectionEyebrow><div className="flex items-end gap-3"><p className="font-display text-[44px] font-extrabold leading-none tracking-[-0.07em] text-[#0E9384]">{submitted}<span className="ml-1 text-[19px] tracking-[-0.03em] text-[#8190A1]">/ 24</span></p><p className="mb-1.5 text-[12px] font-extrabold text-[#40586A]">updates submitted</p></div><p className="mt-2 text-[12px] font-medium text-[#718093]">Daily compliance is 58%. Two blockers are waiting for a decision.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><PulseStat label="On time" value="18" tone="text-[#0A7B70] bg-[#EAF7F4]" /><PulseStat label="Late" value="3" tone="text-[#B07112] bg-[#FFF7E8]" /><PulseStat label="Absent" value="3" tone="text-[#9A5B66] bg-[#FFF1F3]" /><PulseStat label="Blockers" value="2" tone="text-[#266D8F] bg-[#EAF4F9]" /></div>
      </div>
    </section>
    <section className="dwell overflow-hidden rounded-2xl border border-[#E2E9F0] bg-white shadow-[0_12px_40px_rgba(22,50,65,0.04)]">
      <div className="flex flex-col gap-4 border-b border-[#E7EDF2] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl bg-[#F2F5F8] p-1"><button onClick={() => setIsGrid(false)} className={cn("flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-extrabold transition-all", !isGrid ? "bg-white text-[#163144] shadow-[0_2px_7px_rgba(25,48,66,0.10)]" : "text-[#8190A1]")}><LayoutList className="h-3.5 w-3.5" />List</button><button onClick={() => setIsGrid(true)} className={cn("flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-extrabold transition-all", isGrid ? "bg-white text-[#163144] shadow-[0_2px_7px_rgba(25,48,66,0.10)]" : "text-[#8190A1]")}><Grid2X2 className="h-3.5 w-3.5" />Grid</button></div>
          <div className="ml-0 flex rounded-xl border border-[#E4EAF0] bg-white p-1 sm:ml-1"><button onClick={() => setDatePreset("Today")} className={cn("h-7 rounded-lg px-2.5 text-[11px] font-extrabold", datePreset === "Today" ? "bg-[#EAF7F4] text-[#08776B]" : "text-[#8090A1]")}>Today</button><button onClick={() => setDatePreset("Yesterday")} className={cn("h-7 rounded-lg px-2.5 text-[11px] font-extrabold", datePreset === "Yesterday" ? "bg-[#EAF7F4] text-[#08776B]" : "text-[#8090A1]")}>Yesterday</button></div>
          <div className="relative"><CalendarDays className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#8090A1]" /><input aria-label="Select status date" type="date" value={date} onChange={(event) => { setDate(event.target.value); setDatePreset("Custom"); }} className="h-9 rounded-xl border border-[#E0E7EE] bg-white pl-8 pr-2 text-[11px] font-bold text-[#586C7F] outline-none ring-[#0E9384] focus:ring-2" /></div>
        </div>
        <div className="relative w-full lg:w-60"><Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8291A2]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a teammate..." className="h-9 border-[#E1E8EF] bg-[#FAFBFC] pl-8 text-[12px] placeholder:text-[#99A5B3] focus-visible:ring-[#0E9384]" /></div>
      </div>
      {isGrid ? <TeamGrid members={members} onHistory={onHistory} /> : <TeamTable members={members} onHistory={onHistory} />}
    </section>
  </>;
}

function PulseStat({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className={cn("min-w-[72px] rounded-xl px-3 py-2.5", tone)}><p className="font-display text-[20px] font-extrabold leading-none tracking-[-0.04em]">{value}</p><p className="mt-1 text-[10px] font-bold opacity-75">{label}</p></div>; }

function TeamTable({ members, onHistory }: { members: TeamMember[]; onHistory: (member: TeamMember) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[930px] border-collapse"><thead><tr className="border-b border-[#E8EDF2] bg-[#FBFCFD] text-left"><th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Developer</th><th className="px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Status</th><th className="px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Hours</th><th className="px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Tasks summary</th><th className="px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Blockers</th><th className="px-5 py-3.5 text-right text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Action</th></tr></thead><tbody>{members.map((member, index) => <tr key={member.id} className="group border-b border-[#EDF1F4] transition-colors hover:bg-[#FBFCFD]" style={{ animationDelay: `${index * 40}ms` }}><td className="px-5 py-4"><Person member={member} /></td><td className="px-4 py-4"><StatusBadge status={member.status} /></td><td className="px-4 py-4 text-[13px] font-extrabold text-[#20384A]">{member.hours}</td><td className="max-w-[330px] px-4 py-4">{member.tasks.length ? <div className="space-y-1.5">{member.tasks.slice(0, 2).map((task) => <div key={task.title} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#0E9384]" /><p className="truncate text-[12px] font-semibold text-[#576A7B]">{task.title} <span className="ml-1 text-[10px] font-bold text-[#95A1AE]">{task.duration}</span></p></div>)}</div> : <p className="text-[12px] font-semibold text-[#A0ACB8]">No update for this date</p>}</td><td className="max-w-[180px] px-4 py-4"><p className={cn("line-clamp-2 text-[12px] font-semibold leading-5", member.blockers ? "text-[#B56B19]" : "text-[#A0ACB8]")}>{member.blockers ?? "—"}</p></td><td className="px-5 py-4 text-right"><button onClick={() => onHistory(member)} className="rounded-lg px-2 py-1.5 text-[11px] font-extrabold text-[#0B7A6E] transition-colors hover:bg-[#EAF7F4]">View history</button></td></tr>)}</tbody></table></div>;
}

function TeamGrid({ members, onHistory }: { members: TeamMember[]; onHistory: (member: TeamMember) => void }) { return <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{members.map((member, index) => <article key={member.id} className="dwell group rounded-xl border border-[#E5EBF0] bg-[#FEFEFE] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(22,50,65,0.07)]" style={{ animationDelay: `${index * 45}ms` }}><div className="flex items-start justify-between"><Person member={member} compact /><StatusBadge status={member.status} /></div><div className="my-5 border-y border-[#EDF1F4] py-3.5"><p className="font-display text-[21px] font-extrabold tracking-[-0.04em] text-[#20384A]">{member.hours}</p><p className="mt-1 text-[11px] font-semibold text-[#8291A1]">{member.tasks.length ? member.tasks[0].title : "No update submitted for this date"}</p></div><button onClick={() => onHistory(member)} className="flex items-center gap-1 text-[11px] font-extrabold text-[#0B7A6E]">View full history <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button></article>)}</div>; }

function MyUpdates({ punchedIn, onOpenNew }: { punchedIn: boolean; onOpenNew: () => void }) { return <><PageHeading eyebrow="Personal workspace / Tuesday" title="Developer dashboard" description="Log the work that changed today, keep task evidence together, and surface blockers early." action={<Button onClick={onOpenNew} disabled={!punchedIn} className="h-10 rounded-xl bg-[#0E9384] px-4 text-[12px] font-extrabold text-white shadow-none hover:bg-[#087D71] disabled:bg-[#B8C7C9]"><Plus className="mr-1.5 h-4 w-4" />New update</Button>} />{!punchedIn && <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#F3E2B6] bg-[#FFFBEF] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF1CC] text-[#A66B0E]"><CircleAlert className="h-4 w-4" /></div><div><p className="text-[12px] font-extrabold text-[#79520F]">Punch in required</p><p className="mt-1 text-[12px] font-medium text-[#9B732E]">You can add a work update after you have punched in for the day.</p></div></div><Badge className="w-fit border-[#F2D790] bg-white text-[10px] font-extrabold text-[#916216]">9:00 AM – 6:30 PM IST</Badge></div>}<section className="grid gap-4 lg:grid-cols-[1.45fr_0.9fr]"><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><MetricCard label="Total days updated" value="5" detail="Keep the work log continuous" icon={<CalendarDays className="h-4 w-4" />} tone="bg-[#EAF7F4] text-[#0E786C]" /><MetricCard label="Pending assigned tasks" value="0" detail="Nothing needs your action" icon={<CheckCheck className="h-4 w-4" />} tone="bg-[#EAF0FF] text-[#3159AF]" /></div><div className="rounded-2xl border border-[#E3EAF0] bg-white p-5 shadow-[0_12px_40px_rgba(22,50,65,0.04)]"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><SectionEyebrow>Work updates</SectionEyebrow><h2 className="font-display text-[20px] font-extrabold tracking-[-0.04em]">Your latest entries</h2></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8291A2]" /><Input placeholder="Search your updates..." className="h-9 w-52 border-[#E1E8EF] bg-[#FAFBFC] pl-8 text-[12px]" /></div></div><UpdateHistory /></div></div><aside className="relative overflow-hidden rounded-2xl border border-[#E1EBEA] bg-white p-5 shadow-[0_12px_40px_rgba(22,50,65,0.04)]"><img src={teamOrbitUrl} alt="Abstract team orbit" className="pointer-events-none absolute -right-14 bottom-0 h-64 w-64 object-cover opacity-70 mix-blend-multiply" /><div className="relative"><SectionEyebrow>Today’s attendance</SectionEyebrow><h2 className="font-display text-[21px] font-extrabold tracking-[-0.04em]">Your working window</h2><p className="mt-1 text-[12px] font-medium text-[#738294]">Office hours · 9:00 AM – 6:30 PM IST</p><div className="my-6 rounded-xl bg-[#F4F8FA] p-3.5"><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-[#7B8B9C]">Status</span><span className={cn("flex items-center gap-1.5 text-[11px] font-extrabold", punchedIn ? "text-[#08776B]" : "text-[#A66B0E]")}><span className={cn("h-2 w-2 rounded-full", punchedIn ? "bg-[#11A991]" : "bg-[#DCA43B]")} />{punchedIn ? "Working" : "Not punched in"}</span></div><p className="mt-3 font-display text-[28px] font-extrabold tracking-[-0.05em] text-[#1B3447]">{punchedIn ? "08h 14m" : "—"}</p><p className="mt-1 text-[11px] font-semibold text-[#90A0AE]">{punchedIn ? "since 8:56 AM" : "Punch in to begin tracking"}</p></div><p className="max-w-[210px] text-[12px] font-medium leading-5 text-[#687A8C]">Your daily update is clearest when it is written before you punch out.</p></div></aside></section></>; }

function MetricCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: React.ReactNode; tone: string }) { return <article className="rounded-2xl border border-[#E3EAF0] bg-white p-5 shadow-[0_12px_40px_rgba(22,50,65,0.04)]"><div className="flex items-center justify-between"><p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#8290A1]">{label}</p><span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", tone)}>{icon}</span></div><p className="mt-5 font-display text-[32px] font-extrabold tracking-[-0.06em] text-[#173044]">{value}</p><p className="mt-1 text-[11px] font-semibold text-[#8290A1]">{detail}</p></article>; }

function UpdateHistory() { return <div className="space-y-3"><article className="rounded-xl border border-[#E7EDF2] bg-[#FEFEFE] p-4"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><p className="text-[12px] font-extrabold text-[#233D50]">Monday, 25 August</p><Badge className="border-[#C9E8E1] bg-[#EAF7F4] text-[10px] font-extrabold text-[#08776B]">8h 30m</Badge></div><div className="mt-3 space-y-2"><p className="text-[12px] font-semibold text-[#607284]"><span className="mr-2 text-[#0E9384]">●</span>Validated Razorpay failure recovery <span className="ml-1 text-[#9AA7B4]">4h 15m</span></p><p className="text-[12px] font-semibold text-[#607284]"><span className="mr-2 text-[#0E9384]">●</span>Reviewed DevSync UI flow <span className="ml-1 text-[#9AA7B4]">4h 15m</span></p></div></div><button onClick={() => toast.message("Edit opens in the connected product.")} className="rounded-lg p-2 text-[#8391A1] hover:bg-[#F2F5F8] hover:text-[#315067]"><MoreHorizontal className="h-4 w-4" /></button></div></article><article className="rounded-xl border border-[#E7EDF2] bg-[#FEFEFE] p-4"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><p className="text-[12px] font-extrabold text-[#233D50]">Friday, 22 August</p><Badge className="border-[#C9E8E1] bg-[#EAF7F4] text-[10px] font-extrabold text-[#08776B]">7h 45m</Badge></div><p className="mt-3 text-[12px] font-semibold text-[#607284]"><span className="mr-2 text-[#0E9384]">●</span>Prepared API issue handoff <span className="ml-1 text-[#9AA7B4]">7h 45m</span></p><p className="mt-3 rounded-lg bg-[#FFF8E9] px-2.5 py-2 text-[11px] font-semibold leading-5 text-[#9A6B1F]">Blocker: Awaiting confirmation on payout retry edge case.</p></div><button onClick={() => toast.message("Edit opens in the connected product.")} className="rounded-lg p-2 text-[#8391A1] hover:bg-[#F2F5F8] hover:text-[#315067]"><MoreHorizontal className="h-4 w-4" /></button></div></article></div>; }

function Attendance({ members }: { members: TeamMember[] }) { const [range, setRange] = useState("Today"); const [employee, setEmployee] = useState("All Employees"); return <><PageHeading eyebrow="Team presence / live today" title="Team attendance" description="Track punch times, working state, and presence patterns without leaving the daily operating view." action={<Button variant="outline" onClick={() => toast.message("Attendance export is available once this prototype is connected to real records.")} className="h-9 rounded-xl border-[#DCE5ED] bg-white px-3 text-[12px] font-extrabold text-[#5D7082] shadow-none"><ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />Export attendance</Button>} /><section className="overflow-hidden rounded-2xl border border-[#E2E9F0] bg-white shadow-[0_12px_40px_rgba(22,50,65,0.04)]"><div className="flex flex-col gap-4 border-b border-[#E7EDF2] p-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-1.5">{["Today", "Yesterday", "Last 7 Days", "This Month", "Last Month"].map((item) => <button key={item} onClick={() => setRange(item)} className={cn("rounded-lg px-3 py-2 text-[11px] font-extrabold transition-colors", range === item ? "bg-[#EAF7F4] text-[#08776B]" : "text-[#718294] hover:bg-[#F3F6F8]")}>{item}</button>)}</div><DropdownMenu><DropdownMenuTrigger asChild><button className="flex h-9 min-w-48 items-center justify-between rounded-xl border border-[#E0E7EE] bg-[#FAFBFC] px-3 text-[12px] font-bold text-[#607284]">{employee}<ChevronDown className="h-3.5 w-3.5" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="max-h-64 w-56 overflow-auto border-[#E3EAF0] bg-white"><DropdownMenuLabel className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8B99A7]">Filter employee</DropdownMenuLabel><DropdownMenuItem onClick={() => setEmployee("All Employees")}>All Employees</DropdownMenuItem>{members.map((member) => <DropdownMenuItem key={member.id} onClick={() => setEmployee(member.name)}>{member.name}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div><div className="overflow-x-auto"><table className="w-full min-w-[830px]"><thead><tr className="border-b border-[#E8EDF2] bg-[#FBFCFD] text-left"><th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Team member</th><th className="px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Status</th><th className="px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Punch in</th><th className="px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Punch out</th><th className="px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Device / IP</th></tr></thead><tbody>{members.filter((member) => employee === "All Employees" || member.name === employee).slice(0, 8).map((member) => <tr key={member.id} className="border-b border-[#EDF1F4] hover:bg-[#FBFCFD]"><td className="px-5 py-4"><Person member={member} /></td><td className="px-4 py-4"><span className={cn("inline-flex items-center gap-2 text-[12px] font-extrabold", member.presence === "Working" ? "text-[#08776B]" : "text-[#64758A]")}><PresenceDot presence={member.presence} />{member.presence === "Working" ? (member.punchIn && member.punchIn > "9:00 AM" ? "Late · Working" : "On time · Working") : member.presence}</span></td><td className="px-4 py-4 text-[12px] font-bold text-[#52677A]">{member.punchIn ?? "—"}</td><td className="px-4 py-4 text-[12px] font-bold text-[#52677A]">{member.punchOut ?? "—"}</td><td className="px-4 py-4"><p className="text-[11px] font-bold text-[#627386]">110.226.115.114</p><p className="mt-1 text-[10px] font-medium text-[#9AA6B3]">Chrome · Windows</p></td></tr>)}</tbody></table></div></section></>; }

function RoleManagement({ members, onDelete, onSetRole }: { members: TeamMember[]; onDelete: (member: TeamMember) => void; onSetRole: (member: TeamMember) => void }) { return <><PageHeading eyebrow="Access control / 24 people" title="Manage team roles" description="Roles determine the level of team visibility and administrative control each teammate receives." action={<Button variant="outline" onClick={() => toast.message("User invitations are available when the product is connected to user management.")} className="h-9 rounded-xl border-[#DCE5ED] bg-white px-3 text-[12px] font-extrabold text-[#5D7082] shadow-none"><Plus className="mr-1.5 h-3.5 w-3.5" />Invite teammate</Button>} /><section className="overflow-hidden rounded-2xl border border-[#E2E9F0] bg-white shadow-[0_12px_40px_rgba(22,50,65,0.04)]"><div className="flex items-center justify-between border-b border-[#E7EDF2] px-5 py-4"><div><SectionEyebrow>Directory</SectionEyebrow><p className="text-[13px] font-bold text-[#304759]">10 visible team members</p></div><div className="flex items-center gap-2 text-[11px] font-bold text-[#708294]"><ShieldCheck className="h-4 w-4 text-[#0E9384]" />Admin-only surface</div></div><div className="overflow-x-auto"><table className="w-full min-w-[800px]"><thead><tr className="border-b border-[#E8EDF2] bg-[#FBFCFD] text-left"><th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">User</th><th className="px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Email</th><th className="px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Current role</th><th className="px-4 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Change role</th><th className="px-5 py-3.5 text-right text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8391A1]">Actions</th></tr></thead><tbody>{members.map((member) => <tr key={member.id} className="border-b border-[#EDF1F4] hover:bg-[#FBFCFD]"><td className="px-5 py-3.5"><Person member={member} compact /></td><td className="px-4 py-3.5 text-[12px] font-semibold text-[#697A8C]">{member.email}</td><td className="px-4 py-3.5"><Badge className={cn("border text-[10px] font-extrabold", member.role === "Admin" ? "border-[#D8D0F5] bg-[#F4F1FF] text-[#694BB1]" : "border-[#DCE5ED] bg-[#F7F9FB] text-[#5C6E80]")}>{member.role}</Badge></td><td className="px-4 py-3.5"><button onClick={() => onSetRole(member)} className="flex h-8 min-w-28 items-center justify-between rounded-lg border border-[#E0E7EE] bg-white px-2.5 text-[11px] font-bold text-[#5A6D7F]">{member.role}<ChevronDown className="ml-4 h-3.5 w-3.5" /></button></td><td className="px-5 py-3.5 text-right"><button onClick={() => onDelete(member)} className="rounded-lg p-2 text-[#A5B0BB] transition-colors hover:bg-[#FFF0F2] hover:text-[#C84D60]"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div></section></>; }

function EmployeeDetail({ member, onBack, onAssign, remarkOpen, setRemarkOpen }: { member: TeamMember; onBack: () => void; onAssign: () => void; remarkOpen: boolean; setRemarkOpen: (open: boolean) => void }) { const [tab, setTab] = useState("pending"); return <><button onClick={onBack} className="mb-5 flex items-center gap-1.5 text-[12px] font-extrabold text-[#607488] transition-colors hover:text-[#0B7A6E]"><ArrowLeft className="h-4 w-4" />Back to team updates</button><PageHeading eyebrow="Developer workspace / work history" title={`${member.name}'s details`} description="Review assigned tasks, daily work evidence, and the context behind unfinished work." action={<Button onClick={onAssign} className="h-10 rounded-xl bg-[#0E9384] px-4 text-[12px] font-extrabold text-white shadow-none hover:bg-[#087D71]"><Plus className="mr-1.5 h-4 w-4" />Assign new task</Button>} /><section className="mb-5 grid gap-4 lg:grid-cols-[1.35fr_0.85fr]"><div className="rounded-2xl border border-[#E2E9F0] bg-white p-5 shadow-[0_12px_40px_rgba(22,50,65,0.04)]"><div className="flex items-center gap-4"><Person member={member} /><div className="h-8 w-px bg-[#E7EDF2]" /><div><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#93A0AD]">Current state</p><p className="mt-1 flex items-center gap-2 text-[13px] font-extrabold text-[#08776B]"><PresenceDot presence={member.presence} />{member.presence}</p></div><div className="ml-auto hidden text-right sm:block"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#93A0AD]">Today</p><p className="mt-1 text-[13px] font-extrabold text-[#2D4658]">{member.status === "Submitted" ? member.hours : "No update yet"}</p></div></div></div><div className="relative overflow-hidden rounded-2xl border border-[#DFE9E9] bg-white p-5 shadow-[0_12px_40px_rgba(22,50,65,0.04)]"><img src={attendanceOrbitUrl} alt="Abstract attendance pulse" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 object-cover opacity-70 mix-blend-multiply" /><div className="relative"><SectionEyebrow>Last punch in</SectionEyebrow><p className="font-display text-[25px] font-extrabold tracking-[-0.05em] text-[#1B3447]">{member.punchIn ?? "—"}</p><p className="mt-1 text-[11px] font-bold text-[#7D8D9D]">Office hours start at 9:00 AM IST</p></div></div></section><section className="grid gap-5 xl:grid-cols-[1fr_1.25fr]"><div className="rounded-2xl border border-[#E2E9F0] bg-white p-5 shadow-[0_12px_40px_rgba(22,50,65,0.04)]"><div className="mb-5"><SectionEyebrow>Assigned tasks</SectionEyebrow><h2 className="font-display text-[20px] font-extrabold tracking-[-0.04em]">Work queue</h2></div><Tabs defaultValue="pending" value={tab} onValueChange={setTab}><TabsList className="mb-4 h-9 w-full rounded-xl bg-[#F2F5F8] p-1"><TabsTrigger value="pending" className="flex-1 rounded-lg text-[11px] font-extrabold data-[state=active]:bg-white data-[state=active]:shadow-sm">Pending <span className="ml-1 text-[#0E9384]">1</span></TabsTrigger><TabsTrigger value="completed" className="flex-1 rounded-lg text-[11px] font-extrabold data-[state=active]:bg-white data-[state=active]:shadow-sm">Completed <span className="ml-1 text-[#8290A1]">2</span></TabsTrigger></TabsList><TabsContent value="pending" className="mt-0"><article className="rounded-xl border border-[#E4EBF1] p-4"><div className="flex gap-3"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#C6D1DC]" /><div><p className="text-[12px] font-extrabold leading-5 text-[#324C60]">Review API contracts for activity feed</p><p className="mt-1.5 text-[10px] font-semibold text-[#91A0AD]">Assigned today · by Anurag Savaliya</p><button onClick={() => toast.message("Task status change is available in the connected product.")} className="mt-3 text-[11px] font-extrabold text-[#0B7A6E]">Mark complete</button></div></div></article></TabsContent><TabsContent value="completed" className="mt-0 space-y-3"><article className="rounded-xl border border-[#E4EBF1] p-4"><div className="flex items-start gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0E9384] text-white"><Check className="h-3 w-3" /></span><div className="min-w-0 flex-1"><p className="text-[12px] font-bold text-[#8492A0] line-through">Refined audit log error copy</p><p className="mt-1.5 text-[10px] font-semibold text-[#91A0AD]">Completed Aug 25 · 5:32 PM</p><button onClick={() => setRemarkOpen(!remarkOpen)} className="mt-3 text-[11px] font-extrabold text-[#0B7A6E]">{remarkOpen ? "Hide remarks" : "Remarks"}</button>{remarkOpen && <div className="pop-in mt-3 border-t border-[#EDF1F4] pt-3"><p className="text-[11px] font-semibold text-[#91A0AD]">No remarks yet</p><div className="mt-2 flex gap-2"><Input placeholder="Add a remark..." className="h-8 border-[#E2E9EF] text-[11px]" /><Button onClick={() => toast.success("Remark sent")} className="h-8 rounded-lg bg-[#1B3447] px-3 text-[11px] font-extrabold">Send</Button></div></div>}</div></div></article><article className="rounded-xl border border-[#E4EBF1] p-4"><div className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0E9384] text-white"><Check className="h-3 w-3" /></span><div><p className="text-[12px] font-bold text-[#8492A0] line-through">Mapped notification read states</p><p className="mt-1.5 text-[10px] font-semibold text-[#91A0AD]">Completed Aug 22 · 4:15 PM</p></div></div></article></TabsContent></Tabs></div><div className="rounded-2xl border border-[#E2E9F0] bg-white p-5 shadow-[0_12px_40px_rgba(22,50,65,0.04)]"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><SectionEyebrow>Work history</SectionEyebrow><h2 className="font-display text-[20px] font-extrabold tracking-[-0.04em]">Daily evidence</h2></div><DropdownMenu><DropdownMenuTrigger asChild><button className="flex h-8 items-center gap-2 rounded-lg border border-[#E1E8EF] px-2.5 text-[11px] font-bold text-[#607284]">Last 7 Days <ChevronDown className="h-3.5 w-3.5" /></button></DropdownMenuTrigger><DropdownMenuContent className="border-[#E3EAF0] bg-white"><DropdownMenuItem>Last 7 Days</DropdownMenuItem><DropdownMenuItem>This Month</DropdownMenuItem><DropdownMenuItem>All Time</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><div className="space-y-3">{["Monday, 25 August", "Friday, 22 August"].map((day, index) => <article key={day} className="rounded-xl border border-[#E8EDF2] bg-[#FEFEFE] p-4"><div className="flex items-center justify-between"><p className="text-[12px] font-extrabold text-[#2F485B]">{day}</p><Badge className="border-[#C9E8E1] bg-[#EAF7F4] text-[10px] font-extrabold text-[#08776B]">{index === 0 ? "8h 00m" : "7h 30m"}</Badge></div><p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#96A2AE]">Tasks completed</p><p className="mt-1.5 text-[12px] font-semibold leading-5 text-[#617386]">{index === 0 ? "Optimised socket event batching · Stabilised notification payloads" : "Handled purchase edge cases · Updated QA handoff notes"}</p></article>)}</div></div></section></>; }

function NotificationSheet({ open, onOpenChange, notifications, unreadCount, onMarkAll, onMarkOne }: { open: boolean; onOpenChange: (open: boolean) => void; notifications: Notice[]; unreadCount: number; onMarkAll: () => void; onMarkOne: (id: number) => void }) { return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="w-full border-[#E3EAF0] bg-[#FEFEFE] p-0 sm:max-w-[390px]"><SheetHeader className="border-b border-[#E7EDF2] px-5 py-5 text-left"><div className="flex items-start justify-between"><div><SheetTitle className="font-display text-[22px] font-extrabold tracking-[-0.04em] text-[#183245]">Inbox</SheetTitle><SheetDescription className="mt-1 text-[12px] font-medium text-[#7B8B9B]">{unreadCount ? `${unreadCount} updates need your attention` : "You are all caught up"}</SheetDescription></div>{unreadCount > 0 && <button onClick={onMarkAll} className="text-[11px] font-extrabold text-[#0B7A6E] hover:text-[#075F57]">Mark all read</button>}</div></SheetHeader><div className="space-y-2 p-3">{notifications.map((notice) => <article key={notice.id} className={cn("group rounded-xl border p-3.5 transition-colors", notice.read ? "border-transparent bg-transparent" : "border-[#E2ECEB] bg-[#F8FCFB]")}><div className="flex gap-3"><span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", notice.tone)}><Activity className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="text-[12px] font-extrabold text-[#2A4457]">{notice.title}</p><p className="shrink-0 text-[10px] font-bold text-[#98A4B0]">{notice.time}</p></div><p className="mt-1 text-[11px] font-medium leading-5 text-[#718193]">{notice.detail}</p>{!notice.read && <button onClick={() => onMarkOne(notice.id)} className="mt-2 text-[10px] font-extrabold text-[#0B7A6E]">Mark as read</button>}</div></div></article>)}</div></SheetContent></Sheet>; }

function UpdateDialog({ open, onOpenChange, value, onChange, duration, setDuration, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; value: string; onChange: (value: string) => void; duration: string; setDuration: (value: string) => void; onSubmit: () => void }) { return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg border-[#E0E8EE] bg-white"><DialogHeader><p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0E9384]">Daily work log</p><DialogTitle className="font-display text-[23px] font-extrabold tracking-[-0.04em] text-[#1A2C3C]">Add today’s update</DialogTitle><DialogDescription className="text-[12px] leading-5 text-[#738294]">Capture the meaningful work, the time it took, and anything that needs team attention.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div><label className="mb-1.5 block text-[11px] font-extrabold text-[#526577]">Task completed</label><Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="What moved forward today?" className="min-h-24 border-[#DDE6ED] text-[13px] focus-visible:ring-[#0E9384]" /></div><div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1.5 block text-[11px] font-extrabold text-[#526577]">Time logged</label><Input value={duration} onChange={(event) => setDuration(event.target.value)} className="h-10 border-[#DDE6ED] text-[12px]" /></div><div><label className="mb-1.5 block text-[11px] font-extrabold text-[#526577]">Update date</label><Input value="26 Aug 2026" readOnly className="h-10 border-[#DDE6ED] bg-[#F8FAFB] text-[12px]" /></div></div><div><label className="mb-1.5 block text-[11px] font-extrabold text-[#526577]">Blockers / notes <span className="font-semibold text-[#99A5B2]">optional</span></label><Textarea placeholder="Share a decision, dependency, or concern the team should know." className="min-h-20 border-[#DDE6ED] text-[12px] focus-visible:ring-[#0E9384]" /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#DCE5ED]">Cancel</Button><Button disabled={!value.trim()} onClick={onSubmit} className="bg-[#0E9384] font-extrabold hover:bg-[#087D71]">Submit update</Button></DialogFooter></DialogContent></Dialog>; }

function TaskDialog({ open, onOpenChange, value, onChange, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; value: string; onChange: (value: string) => void; onSubmit: () => void }) { return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md border-[#E0E8EE] bg-white"><DialogHeader><p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0E9384]">Task assignment</p><DialogTitle className="font-display text-[23px] font-extrabold tracking-[-0.04em] text-[#1A2C3C]">Assign a new task</DialogTitle><DialogDescription className="text-[12px] leading-5 text-[#738294]">Keep the description clear enough that the assignee can start without another meeting.</DialogDescription></DialogHeader><div className="py-2"><label className="mb-1.5 block text-[11px] font-extrabold text-[#526577]">Task description</label><Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="What needs to be done?" className="min-h-28 border-[#DDE6ED] text-[13px] focus-visible:ring-[#0E9384]" /></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#DCE5ED]">Cancel</Button><Button disabled={!value.trim()} onClick={onSubmit} className="bg-[#0E9384] font-extrabold hover:bg-[#087D71]">Assign task</Button></DialogFooter></DialogContent></Dialog>; }

function RoleDialog({ target, onClose }: { target: TeamMember | null; onClose: () => void }) { const [role, setRole] = useState<Role>(target?.role ?? "Developer"); return <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-sm border-[#E0E8EE] bg-white"><DialogHeader><p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0E9384]">Permission change</p><DialogTitle className="font-display text-[21px] font-extrabold tracking-[-0.04em] text-[#1A2C3C]">Update {target?.name}'s role</DialogTitle><DialogDescription className="text-[12px] leading-5 text-[#738294]">Choose the level of visibility and control this teammate should have.</DialogDescription></DialogHeader><div className="space-y-2 py-2">{(["Developer", "Manager", "Admin"] as Role[]).map((option) => <button key={option} onClick={() => setRole(option)} className={cn("flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors", role === option ? "border-[#9FD8D0] bg-[#F1FBF9]" : "border-[#E3EAF0] hover:bg-[#FAFBFC]")}><div><p className="text-[12px] font-extrabold text-[#354E60]">{option}</p><p className="mt-0.5 text-[10px] font-medium text-[#8794A2]">{option === "Admin" ? "Full operational control" : option === "Manager" ? "Can view team-wide progress" : "Can manage personal updates"}</p></div>{role === option && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0E9384] text-white"><Check className="h-3 w-3" /></span>}</button>)}</div><DialogFooter><Button variant="outline" onClick={onClose} className="border-[#DCE5ED]">Cancel</Button><Button onClick={() => { toast.success(`${target?.name}'s role updated to ${role}`); onClose(); }} className="bg-[#0E9384] font-extrabold hover:bg-[#087D71]">Save role</Button></DialogFooter></DialogContent></Dialog>; }
