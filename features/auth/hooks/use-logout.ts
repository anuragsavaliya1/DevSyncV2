"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clearSession } from "@/features/auth/api/auth-api";
import { routes } from "@/constants/routes";

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearSession,
    onSuccess: async () => {
      queryClient.clear();
      router.replace(routes.login);
      router.refresh();
    },
  });
}
