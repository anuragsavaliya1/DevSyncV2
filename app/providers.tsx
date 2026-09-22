"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/providers/query-provider";

/** Root client providers. Keep this thin so the root layout stays a Server Component. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
