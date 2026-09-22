export function duration(minutes: number) {
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ""}`.trim()
    : `${minutes}m`;
}

const displayDateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const displayTimeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

export function formatTime(value?: string | null) {
  return value ? displayTimeFormat.format(new Date(value)) : "—";
}

export function formatDate(value: string) {
  return displayDateFormat.format(new Date(`${value}T12:00:00Z`));
}

/** Timestamp as "11 Sep 2026, 06:31 pm" in India time. */
export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

/** Calendar date as dd/mm/yyyy in India time (e.g. notification timestamps). */
export function formatDateNumeric(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function initials(name: string | null, email: string) {
  return (name || email)
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
