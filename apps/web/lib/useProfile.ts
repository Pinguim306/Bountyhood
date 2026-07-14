"use client";

import { useQuery } from "@tanstack/react-query";
import type { Profile } from "./types";

/** Public profile for any address, cached client-side. Null when unset. */
export function useProfile(address?: string) {
  return useQuery({
    queryKey: ["profile", address?.toLowerCase()],
    enabled: !!address,
    staleTime: 60_000,
    queryFn: async (): Promise<Profile | null> => {
      const res = await fetch(`/api/profile/${address}`);
      if (!res.ok) return null;
      return (await res.json()) as Profile | null;
    },
  });
}
