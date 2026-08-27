const syncTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
  timeZoneName: "short",
});

export function getRefreshStatus(lastRefreshedAt: string | null, isRefreshing: boolean) {
  if (!lastRefreshedAt) {
    return isRefreshing ? "Connecting to workspace data…" : "Waiting for workspace data";
  }

  const syncedAt = syncTimeFormatter.format(new Date(lastRefreshedAt));
  return isRefreshing ? `Refreshing · last synced ${syncedAt}` : `Synced ${syncedAt}`;
}
