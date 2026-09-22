export type Role = "developer" | "manager" | "admin";

export type WorkspaceUser = {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastSignedInAt: string;
};

export type WorkspaceTab =
  | "overview"
  | "my-updates"
  | "team-updates"
  | "attendance"
  | "leave"
  | "holidays"
  | "attendance-reports"
  | "roles";
