"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QUERY_CONFIG } from "@/constants/query-config";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: QUERY_CONFIG.staleTime,
            gcTime: QUERY_CONFIG.gcTime,
            retry: QUERY_CONFIG.retry,
            refetchOnWindowFocus: QUERY_CONFIG.refetchOnWindowFocus,
            refetchOnReconnect: QUERY_CONFIG.refetchOnReconnect,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
