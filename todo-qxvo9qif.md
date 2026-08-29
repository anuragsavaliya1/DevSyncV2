# Project TODO

- [x] Add an admin-only employee management view or controls for employee status and deletion.
- [x] Add a persisted disabled/inactive employee state and prevent disabled employees from using protected workflows.
- [x] Add an admin-only permanent employee deletion operation with explicit confirmation.
- [x] Define and implement safe handling for employee history and all related records during permanent deletion.
- [x] Prevent self-deletion and protect the last/owner admin from destructive employee actions.
- [x] Add backend authorization and validation tests for disable, re-enable, and permanent delete.
- [x] Add frontend loading, success, error, and destructive-confirmation states.
- [x] Run type checks, unit tests, and browser visual/flow verification.
- [x] Block deactivation or destructive role changes that would remove the last active admin, with backend coverage.
- [x] Attempt authenticated browser verification of the admin Role management and permanent-delete flow; document the external Firebase domain blocker.
- [x] Diagnose and document the Firebase `auth/unauthorized-domain` error blocking authenticated browser verification; the deployed preview domain must be authorized in Firebase Console.
