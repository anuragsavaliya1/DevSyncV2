# DevSync v1 → v2 Parity Audit

**Reviewed:** 27 August 2026 (IST)  
**Method:** Read-only inspection of the authenticated live v1 Admin workspace, comparison with the implemented and browser-validated v2 workspace, APIs, and MongoDB data model. No write action was performed in v1 or v2 for this audit.

> **Bottom line:** v2 has the core operating workflow, but it is **not yet feature-complete against v1**. Its real missing pieces are primarily the Admin/Manager review tools: employee history, attendance filtering/ranges, work-history search/filtering, and safe task/user administration. The missing employee rows and historical records are an **intentional deferred migration**, not a missing UI feature.

## What v2 already has

| Capability | v1 | v2 status | Notes |
| --- | --- | --- | --- |
| Google-based authenticated access | Available | **Implemented** | v2 uses Firebase Authentication only for identity and server-verified HTTP-only sessions. |
| Roles | Developer, Manager, Admin | **Implemented** | v2 role changes are persistent and audit logged; the initial Admin cannot be self-demoted. |
| Punch in / punch out | Available | **Implemented** | v2 stores punch metadata, includes on-time/late status, and retains device/IP metadata. |
| Daily work update | Available | **Implemented** | v2 supports today/yesterday updates, repeatable tasks, minutes, blockers, and editing the same date’s update. |
| Team compliance view | Available | **Implemented, reduced presentation** | v2 shows each active employee’s submitted/pending state and task summary. |
| List and grid team views | Available | **Implemented** | v2 supports both views. |
| Task assignment | Available | **Implemented** | v2 permits Manager/Admin assignment and creates an in-app notification. |
| Task completion and remarks | Available | **Implemented** | v2 supports completion and embedded task remarks. |
| In-app notifications | Available | **Implemented** | v2 supports individual and bulk read state. |
| Live refresh | Firestore listeners | **Implemented differently** | v2 uses protected 15-second polling with visible last-sync evidence, rather than Firestore listeners. |

## Confirmed v2 gaps

| Priority | Missing in v2 | Evidence from v1 | Practical v2 work required |
| --- | --- | --- | --- |
| **P0** | **Employee detail / history view** | v1 exposes **View History**, a selected-employee detail surface, task assignment, task tabs, and that employee’s work history. | Add a Manager/Admin employee detail route or drawer with selected employee context, task queue, work updates, and a clear return path. |
| **P0** | **Admin task deletion UI with confirmation** | v1 exposes **Delete Task** for task records and a confirmation prompt. | v2 already has an Admin-only delete API, but no usable UI. Add a destructive confirmation dialog, audit result feedback, and refresh. |
| **P0** | **User deactivation/removal workflow** | v1 Role Management exposes **Delete User**. | Do **not** copy hard delete. Add a server-authorized **deactivate/reactivate** workflow in v2, preserving attendance, work updates, tasks, and audit history. |
| **P1** | **Attendance date ranges** | v1 has Today, Yesterday, Last 7 Days, This Month, Last Month, and Custom Date; multi-day output adds a Date column. | Add safe server-side range validation, named date ranges, custom from/to dates, and multi-day rows. |
| **P1** | **Attendance employee filter** | v1 lets an Admin/Manager select one employee or all employees. | Add an employee selector, apply it server-side, and keep the existing single-day table responsive. |
| **P1** | **Team view time/blocker columns** | v1 list view has separate Hours, Tasks Summary, and Blockers columns. | Extend v2 team list with total duration and blocker text as distinct fields; retain grid presentation as a compact alternative. |
| **P1** | **Team View History / Full History actions** | v1 provides a per-user action in both list and grid views. | Link both v2 team view modes to the employee detail/history surface. |
| **P1** | **Employee work-history filters** | v1 supports Last 7 Days, This Month, All Time, free-text search, and From/To dates. | Add indexed server-side filtering by employee, text, and date range. Do not load all historical updates into the browser. |
| **P2** | **Personal work-update search** | v1 has “Search your updates…” over the user’s update history. | Add a self-history search input backed by a constrained server query. |
| **P2** | **Personal summary metrics** | v1 shows Total Days Updated and Pending Assigned Tasks. | Add real MongoDB-derived summary cards; do not hardcode numbers. |
| **P2** | **Today / Yesterday quick controls on Team Updates** | v1 exposes direct shortcuts in addition to the date picker. | Add quick date controls beside the existing v2 date picker. |
| **P2** | **Task queue separation for Admin review** | v1 has Pending and Completed tabs on the selected employee’s task view. | Include status tabs/filters in the new employee detail surface. The developer’s personal v2 queue can remain a single view if completed tasks are visually distinguished. |
| **Review before parity claim** | **Email on task assignment** | The earlier read-only v1 bundle inspection indicated task-assignment email attempts. The live UI proves in-app notifications, not email delivery. | Confirm whether v1 email delivery is business-critical. v2 deliberately has persisted in-app notifications only today. |

## Intentional differences — do not treat these as missing features

| Difference | Why it exists | Required action now |
| --- | --- | --- |
| v2 currently shows only the initial Admin account; v1 shows the existing employee directory and historical work/attendance records. | v2 intentionally starts with a clean MongoDB database. Firestore import is deferred. | Keep v1 intact until a separately reviewed, idempotent migration is built and verified. |
| v2 uses MongoDB as the sole operational datastore; v1 uses Firestore-era data flows. | This was the approved architecture change. | Do not connect v2 directly to v1 Firestore as a shortcut. |
| v2 uses 15-second polling instead of Firestore listeners. | This is a deliberate clean-build implementation. It has been observed refreshing without blocking the UI. | Upgrade to SSE/WebSockets only if 15-second visibility is operationally insufficient. |
| v2 supports open verified-Google signup, defaulting new accounts to Developer. | This is an approved onboarding policy. | Review later if employee membership must be restricted to an allow-list or domain. |
| v2 protects the initial Admin from self-demotion. | Prevents accidental loss of administrative control. | Keep the protection; support multiple additional Admins through the role workflow. |

## What was changed in DevSync v1

**Nothing was changed in v1.** During this audit, I only opened and navigated the authenticated v1 UI: Team Updates, My Updates, Attendance, Role Management, and one employee’s read-only history screen. I did **not** punch in/out, create or edit a daily update, assign or complete a task, change a role, delete a user/task, mark notifications read, alter Firestore, change Firebase configuration, modify source code, or deploy v1.

Therefore, there is **no v1 code, database record, Firebase setting, or dependency that you need to remove because of this v2 work**.

Do **not** delete v1 users, Firestore collections, authentication settings, or historical data yet. v1 remains the only source of the current employee directory and historical operational data until the later migration is designed with backups, dry-run mapping, idempotent upserts, and a reconciliation report.

## Completed v1 visual parity sweep

The live v1 Admin session was inspected read-only across Team Updates list and grid views, My Updates, Attendance ranges and employee selector, Role Management, employee history, pending/completed task views, the expandable remarks panel, and the notification drawer. The drawer showed both bulk and individual mark-as-read controls; no notification state was changed. The completed-task cards showed the delete control, but it was **not clicked**. This completes the visible-workflow comparison.

An implementation-level dependency/function removal inventory is **not available** from UI inspection. It would require read-only access to the v1 repository or a source export. That is a different question from “what did you change in v1?”—the verified answer to that is **nothing**.

## v2 parity implementation progress

The highest-priority Admin/Manager gaps are now implemented in v2: list and grid Team Status views show hours and blockers, both expose an employee-history action, and the selected employee opens in a context-preserving review canvas. The canvas loads real MongoDB work history with Last 7 days, This month, All time, explicit date, and text filters; it includes pending/completed task tabs and inline remarks. In live Admin QA, the existing secondary Developer record and its recorded work update rendered correctly in that view.

Task removal is now an **Admin-only soft archive**, rather than a hard database delete. It requires a confirmation dialog and writes an audit event; archived tasks are excluded from active task lists, comments, and completion actions while their record remains retained. Employee removal is intentionally replaced with audited Admin deactivation/reactivation, which preserves all historical records, blocks the inactive user from creating a fresh DevSync session, prevents self-deactivation, and permanently protects the configured initial Admin from deactivation.

The live Admin session was used to verify the selected secondary Developer’s real history, work update, blocker, completed task, embedded remark count, and task-archive confirmation warning. The employee deactivation confirmation warning was also checked and then cancelled. **Neither destructive confirmation was submitted**, so no user, task, attendance, or work-update data was altered during QA. The UI now includes explicit success feedback after an archive or activation-state change, but that success state remains deliberately unexecuted until the user explicitly approves modifying the secondary Developer or task.

The selected employee’s bounded work-history filter was also applied against the real blocker text `nothing`; the matching work update remained visible. This verifies the filter request, server-side bounded query, and rendered history path without creating or changing data.

With explicit user approval, one task named `DevSync QA — archive validation` was assigned to the secondary Developer and then archived through the new Admin confirmation dialog. The screen showed the assignment success state, the QA task appeared in the pending count, the archive success state stated that its audit history was retained, and the pending count returned to zero. The existing completed task, employee access state, role, attendance, and work update were not changed.

With separate user approval, the secondary account was temporarily promoted from Developer to Manager. Its authenticated workspace exposed Team Updates, Attendance, employee-history review, and task-assignment presentation; it did **not** expose Role Management or the Admin-only task Archive control. Its request to the Admin-only user-directory endpoint returned server-enforced `403 Forbidden`. The secondary account was then restored to **Developer**, which was verified in the live Admin directory. The temporary role change created the expected audited role-change history; no operational records were changed by the boundary test.

The selected secondary Developer’s history was rechecked under the **This month** range and then with explicit start/end dates of `2026-08-27`. In both cases, its one matching work update remained visible. These were read-only requests and did not change any data.

The task-archive route was tightened to reject non-Admin users with an explicit `403 Forbidden` before it reads a task identifier or reaches archive code, matching the existing employee-activity guard. Focused route tests now prove that a Manager cannot trigger either task archival or employee activation-state changes, even with malformed task IDs or request bodies; neither repository mutation is invoked. The full TypeScript check, nine-file Vitest suite with 19 tests, live credential checks, and a production build then passed.

At a 375×812 viewport, both the public DevSync login and native Google sign-in pages render cleanly with readable copy and an accessible primary action. The capture redirects the unauthenticated dashboard to login as designed. The authenticated mobile workspace still requires one session-level check on a real phone or narrow desktop browser before production release.

## Recommended v2 implementation order

| Order | Deliverable | Why this order |
| --- | --- | --- |
| 1 | Employee detail/history surface plus View History actions | Unlocks the main Admin/Manager review workflow and creates the correct home for several missing task/history features. |
| 2 | Safe task deletion and user deactivate/reactivate controls | Completes administrative lifecycle management without risking historical data integrity. |
| 3 | Attendance ranges and employee filter | Brings operational reporting close to v1 without touching historical migration. |
| 4 | Work-history filters, team hours/blockers, and quick date controls | Completes day-to-day supervisor review efficiency. |
| 5 | Personal metrics/search and decision on assignment emails | Useful, but not a blocker for the core workflow. |
| 6 | Separate Firestore → MongoDB migration project | Must remain isolated, reversible, and tested against a backup. |

## Evidence and references

The live v1 checks confirmed the Team Updates, My Updates, Attendance, Role Management, employee detail/history, task assignment, task tabs, and historical-filter surfaces described above. The v2 status reflects the current authenticated MongoDB-backed implementation and its validated protected API routes.

[1]: https://devsync.xitijinfo.com/ "DevSync v1 live workspace"
[2]: https://3000-it25cf44ppm9qho4ebqnv-95cf2949.us4.manus.computer/dashboard "DevSync v2 development workspace"
