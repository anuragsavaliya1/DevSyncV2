/** Derive dashboard slug segments from a pathname under `/dashboard`. */
export function slugFromPathname(pathname: string): string[] {
  const normalized = pathname.replace(/\/+$/, "");
  const prefix = "/dashboard";
  if (normalized === prefix) return [];
  if (!normalized.startsWith(`${prefix}/`)) return [];
  return normalized
    .slice(prefix.length + 1)
    .split("/")
    .filter(Boolean);
}
