/**
 * Central React Query refresh policy for DevSync.
 * Prefer staleTime + targeted invalidation; poll only where near-real-time is required.
 */
export const QUERY_CONFIG = {
  staleTime: 30_000,
  gcTime: 5 * 60 * 1000,
  retry: 1,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  /** Default page size for table list pagination (start/limit). */
  listPageSize: 10,
  notifications: {
    /** Near-real-time signal feed; replaceable later with WS/SSE without UI changes. */
    refetchInterval: 60_000,
    /** Page size for drawer infinite scroll. */
    pageSize: 20,
  },
} as const;
