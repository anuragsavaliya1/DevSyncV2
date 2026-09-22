import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";

/** Manual workspace refresh — core datasets only (not lazy team/users unless requested). */
export async function invalidateWorkspaceCore(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.workUpdates.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.infinite }),
  ]);
}

export async function invalidateAttendance(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
}

export async function invalidateLeave(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.leave.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard.all }),
  ]);
}

export async function invalidateHolidays(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.holidays.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all }),
  ]);
}

export async function invalidateAdminDashboard(queryClient: QueryClient) {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.adminDashboard.all,
    refetchType: "active",
  });
}

export async function invalidateAttendanceReports(queryClient: QueryClient) {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.attendanceReports.all,
  });
}

export async function invalidateWorkUpdates(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.workUpdates.all });
}

export async function invalidateTasks(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
}

export async function invalidateNotifications(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.all,
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.infinite,
    }),
  ]);
}

export async function invalidateTeam(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
}

export async function invalidateUsers(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
}

/** Assign / complete / remark / archive — tasks plus signals that managers/devs share. */
export async function invalidateTaskRelated(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.team.all }),
  ]);
}

/** Work-update submit affects personal history and team compliance views. */
export async function invalidateWorkUpdateRelated(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.workUpdates.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.team.all }),
  ]);
}

/** Role/activity/delete affects admin list and team membership views. */
export async function invalidateUserRelated(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.team.all }),
  ]);
}
