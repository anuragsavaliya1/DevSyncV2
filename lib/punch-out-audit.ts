/** Pure helpers for punch-out origin / audit visibility. */
import type { Role } from "@/lib/roles";

export type PunchOutSource = "employee" | "regularization" | "manual";
export type PunchInSource = "employee" | "regularization" | "manual";

export type PunchOutAuditActor = {
  id: string;
  displayName: string | null;
  email: string;
  role: Role;
};

export type PunchOutAudit = {
  source: PunchOutSource;
  recordedBy: PunchOutAuditActor | null;
  recordedAt: string | null;
  reason: string | null;
  requestStatus: "approved" | null;
  requestedAt: string | null;
};

export type PunchInAudit = {
  source: PunchInSource;
  recordedBy: PunchOutAuditActor | null;
  recordedAt: string | null;
  reason: string | null;
  requestStatus: "approved" | null;
  requestedAt: string | null;
};

/** Legacy punched-out rows without source are treated as normal employee punch-outs. */
export function resolvePunchOutSource(input: {
  punchOutAt?: string | Date | null;
  punchOutSource?: PunchOutSource | null;
}): PunchOutSource | null {
  if (!input.punchOutAt) return null;
  return input.punchOutSource ?? "employee";
}

export function resolvePunchInSource(input: {
  punchInAt?: string | Date | null;
  punchInSource?: PunchInSource | null;
}): PunchInSource | null {
  if (!input.punchInAt) return null;
  return input.punchInSource ?? "employee";
}

export function isManagedPunchOutSource(source: PunchOutSource | null) {
  return source === "regularization" || source === "manual";
}

export function isManagedPunchInSource(source: PunchInSource | null) {
  return source === "regularization" || source === "manual";
}

export type TeamAttendanceStatusTag =
  | "Correction requested"
  | "Absent"
  | "Missing in"
  | "Manual"
  | "Regularized"
  | "Working"
  | "Late"
  | "On time"
  | "On Leave";

export type TeamAttendanceStatusLayers = {
  /** Working / Manual / Regularized / Absent / etc. */
  primary: TeamAttendanceStatusTag[];
  /** Punch-in timing — shown on the second line when present. */
  arrival: "Late" | "On time" | null;
  /** Approved leave covering the work date — shown below primary/arrival. */
  leave: "On Leave" | null;
};

/**
 * Admin/Manager team attendance Status layers.
 * Primary status on line 1; Late / On time on line 2; On Leave on line 3 when applicable.
 */
export function teamAttendanceStatusLayers(input: {
  record: {
    state?: "working" | "punched_out" | string;
    classification?: "on_time" | "late" | string | null;
    punchInAt?: string | Date | null;
    punchOutAt?: string | Date | null;
    punchInSource?: PunchInSource | null;
    punchOutSource?: PunchOutSource | null;
  } | null;
  hasPendingCorrection?: boolean;
  onLeave?: boolean;
}): TeamAttendanceStatusLayers {
  const leave: TeamAttendanceStatusLayers["leave"] = input.onLeave
    ? "On Leave"
    : null;

  if (input.hasPendingCorrection) {
    return { primary: ["Correction requested"], arrival: null, leave };
  }
  const record = input.record;
  if (!record) return { primary: ["Absent"], arrival: null, leave };
  if (record.punchOutAt && !record.punchInAt) {
    return { primary: ["Missing in"], arrival: null, leave };
  }

  const primary: TeamAttendanceStatusTag[] = [];
  const inSource = resolvePunchInSource(record);
  const outSource = resolvePunchOutSource(record);

  if (inSource === "manual" || outSource === "manual") {
    primary.push("Manual");
  } else if (
    inSource === "regularization" ||
    outSource === "regularization"
  ) {
    primary.push("Regularized");
  } else if (record.state === "working") {
    primary.push("Working");
  }

  const arrival: TeamAttendanceStatusLayers["arrival"] = record.punchInAt
    ? record.classification === "late"
      ? "Late"
      : "On time"
    : null;

  if (!primary.length && !arrival) {
    return { primary: ["Absent"], arrival: null, leave };
  }
  return { primary, arrival, leave };
}

/** Flat tags for titles / tests. */
export function teamAttendanceStatusTags(input: {
  record: {
    state?: "working" | "punched_out" | string;
    classification?: "on_time" | "late" | string | null;
    punchInAt?: string | Date | null;
    punchOutAt?: string | Date | null;
    punchInSource?: PunchInSource | null;
    punchOutSource?: PunchOutSource | null;
  } | null;
  hasPendingCorrection?: boolean;
  onLeave?: boolean;
}): TeamAttendanceStatusTag[] {
  const { primary, arrival, leave } = teamAttendanceStatusLayers(input);
  return [
    ...primary,
    ...(arrival ? [arrival] : []),
    ...(leave ? [leave] : []),
  ];
}

/** Single joined label for titles / tests that need one string. */
export function teamAttendanceStatusLabel(input: {
  record: {
    state?: "working" | "punched_out" | string;
    classification?: "on_time" | "late" | string | null;
    punchInAt?: string | Date | null;
    punchOutAt?: string | Date | null;
    punchInSource?: PunchInSource | null;
    punchOutSource?: PunchOutSource | null;
  } | null;
  hasPendingCorrection?: boolean;
  onLeave?: boolean;
}) {
  return teamAttendanceStatusTags(input).join(" · ");
}

export function teamAttendanceStatusTagClass(tag: TeamAttendanceStatusTag) {
  switch (tag) {
    case "Correction requested":
      return "bg-[#FFF7ED] text-[#B45309]";

    case "Missing in":
      return "bg-[#FEF2F2] text-[#B91C1C]";

    case "Late":
      return "bg-[#FFF7ED] text-[#B45309]";

    case "Absent":
      return "bg-[#F3F4F6] text-[#6B7280]";

    case "Manual":
      return "bg-[#F1F5F9] text-[#475569]";

    case "Regularized":
      return "bg-[#F5F3EF] text-[#7C6A4A]";

    case "On Leave":
      return "bg-[#FDF2F8] text-[#9D174D]";

    case "Working":
      return "bg-[#ECFDF5] text-[#047857]";

    case "On time":
      return "bg-[#F0FDF4] text-[#15803D]";

    default:
      return "bg-[#F0FDF4] text-[#15803D]";
  }
}

export function employeePunchOutFields(now: Date) {
  return {
    state: "punched_out" as const,
    punchOutAt: now,
    punchOutSource: "employee" as const,
    punchOutRecordedByUserId: null,
    punchOutRecordedByRole: null,
    updatedAt: now,
  };
}

export function regularizationPunchOutFields(input: {
  punchOutAt: Date;
  actorUserId: string; // hex — converted by caller to ObjectId when writing
  actorRole: Role;
  now: Date;
}) {
  return {
    state: "punched_out" as const,
    punchOutAt: input.punchOutAt,
    punchOutSource: "regularization" as const,
    punchOutRecordedByRole: input.actorRole,
    updatedAt: input.now,
  };
}

export function manualPunchOutFields(input: {
  punchOutAt: Date;
  actorRole: Role;
  now: Date;
}) {
  return {
    state: "punched_out" as const,
    punchOutAt: input.punchOutAt,
    punchOutSource: "manual" as const,
    punchOutRecordedByRole: input.actorRole,
    updatedAt: input.now,
  };
}

export function buildPunchOutAudit(input: {
  punchOutAt?: string | Date | null;
  punchOutSource?: PunchOutSource | null;
  punchOutRecordedByUserId?: string | null;
  punchOutRecordedByRole?: Role | null;
  recordedAt?: string | null;
  reason?: string | null;
  requestStatus?: "approved" | null;
  requestedAt?: string | null;
  actor?: {
    id: string;
    displayName: string | null;
    email: string;
    role: Role;
  } | null;
}): PunchOutAudit | null {
  const source = resolvePunchOutSource(input);
  if (!source) return null;

  const recordedBy =
    source === "employee" || !input.punchOutRecordedByUserId
      ? null
      : input.actor
        ? {
            id: input.actor.id,
            displayName: input.actor.displayName,
            email: input.actor.email,
            role: input.punchOutRecordedByRole ?? input.actor.role,
          }
        : null;

  return {
    source,
    recordedBy,
    recordedAt: input.recordedAt ?? null,
    reason: input.reason ?? null,
    requestStatus: input.requestStatus ?? null,
    requestedAt: input.requestedAt ?? null,
  };
}

export function buildPunchInAudit(input: {
  punchInAt?: string | Date | null;
  punchInSource?: PunchInSource | null;
  punchInRecordedByUserId?: string | null;
  punchInRecordedByRole?: Role | null;
  recordedAt?: string | null;
  reason?: string | null;
  requestStatus?: "approved" | null;
  requestedAt?: string | null;
  actor?: {
    id: string;
    displayName: string | null;
    email: string;
    role: Role;
  } | null;
}): PunchInAudit | null {
  const source = resolvePunchInSource(input);
  if (!source) return null;

  const recordedBy =
    source === "employee" || !input.punchInRecordedByUserId
      ? null
      : input.actor
        ? {
            id: input.actor.id,
            displayName: input.actor.displayName,
            email: input.actor.email,
            role: input.punchInRecordedByRole ?? input.actor.role,
          }
        : null;

  return {
    source,
    recordedBy,
    recordedAt: input.recordedAt ?? null,
    reason: input.reason ?? null,
    requestStatus: input.requestStatus ?? null,
    requestedAt: input.requestedAt ?? null,
  };
}
