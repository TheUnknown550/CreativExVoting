// Mirrors the character limits enforced server-side (backend/internal/services/admin_service.go)
// and by the Postgres CHECK constraints (migration 007). Keep these three numbers in sync with
// both when changing a limit.
export const OBJECTIVE_MAX_LENGTH = 6000;
export const DESIGN_PROCESS_MAX_LENGTH = 7000;
export const IMPACT_MAX_LENGTH = 6000;
